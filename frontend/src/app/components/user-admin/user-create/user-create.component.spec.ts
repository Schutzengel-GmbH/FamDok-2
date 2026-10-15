import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { UserCreateComponent } from './user-create.component';
import { ToastService } from 'src/app/services/toast.service';
import { buildUser } from 'src/app/testing/fixtures';
import { Role } from '../../../../../../shared/generated/prisma/enums';
import { FullOrganisation } from '../../../../../../shared/types';

describe('UserCreateComponent', () => {
  let fixture: ComponentFixture<UserCreateComponent>;
  let component: UserCreateComponent;
  let httpMock: HttpTestingController;
  let toastService: ToastService;

  const org = {
    id: 'org-1',
    name: 'Org 1',
    subOrganisations: [{ id: 'sub-1', name: 'Sub 1', organisationId: 'org-1' }],
  } as any as FullOrganisation;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserCreateComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    toastService = TestBed.inject(ToastService);

    fixture = TestBed.createComponent(UserCreateComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('orgs', [org]);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  function fillValid(overrides: Record<string, any> = {}) {
    component.form.patchValue({
      email: 'new@example.com',
      firstName: 'Neu',
      lastName: 'Nutzer',
      ...overrides,
    });
  }

  it('defaults to a plain User with an invite', () => {
    expect(component.form.controls.role.value).toBe(Role.User);
    expect(component.form.controls.onboarding.value).toBe('invite');
  });

  it('requires email and names', () => {
    expect(component.form.valid).toBeFalse();
    fillValid({ email: 'not-an-email' });
    expect(component.form.controls.email.invalid).toBeTrue();
    fillValid();
    expect(component.form.valid).toBeTrue();
  });

  it('requires an organisation for org-scoped roles', () => {
    fillValid({ role: Role.OrgCoordinator });
    expect(component.form.controls.organisationId.invalid).toBeTrue();

    component.form.patchValue({ organisationId: 'org-1' });
    expect(component.form.valid).toBeTrue();
  });

  it('requires a sub-organisation for SubOrgCoordinator', () => {
    fillValid({ role: Role.SubOrgCoordinator, organisationId: 'org-1' });
    expect(component.form.controls.subOrganisationIds.invalid).toBeTrue();

    component.onSubOrgsChange([org.subOrganisations[0]]);
    expect(component.form.valid).toBeTrue();
  });

  it('does not submit an invalid form', () => {
    component.submit();

    expect(httpMock.match(() => true).length).toBe(0);
  });

  it('posts the new user and emits it', () => {
    const created: any[] = [];
    component.created.subscribe((u) => created.push(u));
    fillValid({ role: Role.OrgCoordinator, organisationId: 'org-1' });

    component.submit();

    const req = httpMock.expectOne((r) => r.url.endsWith('/user'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'new@example.com',
      firstName: 'Neu',
      lastName: 'Nutzer',
      role: Role.OrgCoordinator,
      jobTitle: null,
      organisationId: 'org-1',
      subOrganisationIds: [],
      onboarding: 'invite',
    });
    const user = buildUser({ email: 'new@example.com' });
    req.flush(user);

    expect(created).toEqual([user]);
    expect(toastService.toasts()[0].text).toContain('Einladung');
    expect(component.tempPassword()).toBeUndefined();
    expect(component.form.controls.email.value).toBeFalsy();
    expect(component.form.controls.role.value).toBe(Role.User);
  });

  it('shows the temporary password once and does not emit it', () => {
    const created: any[] = [];
    component.created.subscribe((u) => created.push(u));
    fillValid({ onboarding: 'tempPassword' });

    component.submit();

    const user = buildUser({ email: 'new@example.com' });
    httpMock
      .expectOne((r) => r.url.endsWith('/user'))
      .flush({ ...user, tempPassword: 'Secret-123' });
    fixture.detectChanges();

    expect(component.tempPassword()).toEqual({
      email: 'new@example.com',
      password: 'Secret-123',
    });
    expect(fixture.nativeElement.textContent).toContain('Secret-123');
    expect(created[0].tempPassword).toBeUndefined();
  });

  it('re-enables the form when creating fails', () => {
    fillValid();

    component.submit();
    expect(component.saving()).toBeTrue();
    httpMock
      .expectOne((r) => r.url.endsWith('/user'))
      .flush({ message: 'Conflict' }, { status: 409, statusText: 'Conflict' });

    expect(component.saving()).toBeFalse();
  });
});
