import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { UserAdminComponent } from './user-admin.component';
import { buildUser } from 'src/app/testing/fixtures';
import { Role } from '../../../../../shared/generated/prisma/enums';

describe('UserAdminComponent', () => {
  let fixture: ComponentFixture<UserAdminComponent>;
  let component: UserAdminComponent;
  let httpMock: HttpTestingController;

  const users = [
    buildUser({
      id: 'u1',
      email: 'anna@example.com',
      firstName: 'Anna',
      lastName: 'Admin',
      role: Role.Admin,
      jobTitle: 'Hebamme',
      organisation: { id: 'org-1', name: 'Jugendamt Nord' },
    }),
    buildUser({
      id: 'u2',
      email: 'ben@example.com',
      firstName: 'Ben',
      lastName: 'User',
      role: Role.User,
      jobTitle: 'FGKiKP',
      organisation: { id: 'org-2', name: 'Jugendamt Süd' },
    }),
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserAdminComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(UserAdminComponent);
    component = fixture.componentInstance;

    httpMock.expectOne((r) => r.url.includes('/user')).flush(users);
    httpMock.expectOne((r) => r.url.includes('/org')).flush([]);
  });

  afterEach(() => httpMock.verify());

  it('loads all users and orgs on construction', () => {
    expect(component['users']()).toEqual(users);
    expect(component.orgs).toEqual([]);
  });

  it('shows all users when the filter is empty', () => {
    expect(component['filteredUsers']()).toEqual(users);
  });

  it('filters case-insensitively by email', () => {
    component.filter.set('ANNA@');
    expect(component['filteredUsers']()).toEqual([users[0]]);
  });

  it('filters by first name and last name', () => {
    component.filter.set('user');
    expect(component['filteredUsers']().map((u) => u.id)).toEqual(['u2']);
  });

  it('filters by organisation name', () => {
    component.filter.set('süd');
    expect(component['filteredUsers']().map((u) => u.id)).toEqual(['u2']);
  });

  it('filters by job title', () => {
    component.filter.set('hebamme');
    expect(component['filteredUsers']().map((u) => u.id)).toEqual(['u1']);
  });

  it('filters by role', () => {
    component.filter.set('admin');
    expect(component['filteredUsers']().map((u) => u.id)).toEqual(['u1']);
  });

  it('shows no users when nothing matches', () => {
    component.filter.set('nonexistent');
    expect(component['filteredUsers']()).toEqual([]);
  });

  it('renders one app-user-item per filtered user', () => {
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll('app-user-item').length,
    ).toBe(2);

    component.filter.set('anna');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll('app-user-item').length,
    ).toBe(1);
  });

  it('typing into the filter input updates the filter signal via ngModel, without replacing it', () => {
    fixture.detectChanges();

    const input: HTMLInputElement =
      fixture.nativeElement.querySelector('#filter');
    input.value = 'anna';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    // filter must remain a callable WritableSignal (not overwritten with a raw string)
    // and its value must reflect what was typed.
    expect(component.filter()).toBe('anna');
    expect(component['filteredUsers']().map((u) => u.id)).toEqual(['u1']);
    expect(
      fixture.nativeElement.querySelectorAll('app-user-item').length,
    ).toBe(1);
  });
});

