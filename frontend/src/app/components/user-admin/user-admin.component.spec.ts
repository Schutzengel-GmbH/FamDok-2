import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import Keycloak from 'keycloak-js';

import { UserAdminComponent } from './user-admin.component';
import { UserCreateComponent } from './user-create/user-create.component';
import { buildUser } from 'src/app/testing/fixtures';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { Role } from '../../../../../shared/generated/prisma/enums';

// The users request depends on the logged in user's role, so it is only sent once /me is flushed.
async function setup(role: Role) {
  await TestBed.configureTestingModule({
    imports: [UserAdminComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: Keycloak, useValue: mockKeycloak() },
    ],
  }).compileComponents();

  const httpMock = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(UserAdminComponent);
  httpMock
    .expectOne((r) => r.url.endsWith('/me'))
    .flush(buildUser({ role, organisationId: 'org-1' }));

  return { fixture, httpMock };
}

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
    ({ fixture, httpMock } = await setup(Role.Admin));
    component = fixture.componentInstance;

    httpMock.expectOne((r) => r.url.includes('/user?')).flush(users);
    httpMock.expectOne((r) => r.url.endsWith('/org')).flush([]);
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

[Role.OrgController, Role.OrgCoordinator].forEach((role) => {
  describe(`UserAdminComponent as ${role}`, () => {
    let fixture: ComponentFixture<UserAdminComponent>;
    let httpMock: HttpTestingController;
    const users = [buildUser({ id: 'u1', organisationId: 'org-1' })];

    beforeEach(async () => {
      ({ fixture, httpMock } = await setup(role));

      httpMock
        .expectOne((r) => r.url.includes('/user/org/org-1?'))
        .flush(users);
      httpMock.expectOne((r) => r.url.endsWith('/org')).flush([]);
    });

    afterEach(() => httpMock.verify());

    it('loads only the users of the own organisation', () => {
      expect(fixture.componentInstance['users']()).toEqual(users);
    });

    it('offers neither the organisation nor the Admin/Controller roles when editing', () => {
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelector('app-user-item')).not.toBeNull();
      expect(el.querySelector('#organisationId')).toBeNull();
      expect(el.querySelector('option[value="Admin"]')).toBeNull();
      expect(el.querySelector('option[value="Controller"]')).toBeNull();
    });

    it('creates users in the own organisation, without offering another', () => {
      fixture.componentInstance.creating.set(true);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const create: UserCreateComponent = fixture.debugElement.query(
        By.directive(UserCreateComponent),
      ).componentInstance;

      expect(create.form.controls.organisationId.value).toBe('org-1');
      expect(el.querySelector('#newOrganisationId')).toBeNull();
      expect(el.querySelector('#newRole option[value="Admin"]')).toBeNull();
      expect(
        el.querySelector('#newRole option[value="Controller"]'),
      ).toBeNull();
    });
  });
});

