import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { UserItemComponent } from './user-item.component';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { ToastService } from 'src/app/services/toast.service';
import { buildUser } from 'src/app/testing/fixtures';
import { Role } from '../../../../../../shared/generated/prisma/enums';
import { FullOrganisation, FullSubOrganisation } from '../../../../../../shared/types';

function buildOrg(overrides: Record<string, any> = {}): FullOrganisation {
  return {
    id: 'org-1',
    name: 'Org 1',
    subOrganisations: [],
    ...overrides,
  } as any;
}

function buildSubOrg(overrides: Record<string, any> = {}): FullSubOrganisation {
  return {
    id: 'sub-1',
    name: 'Sub 1',
    organisationId: 'org-1',
    ...overrides,
  } as any;
}

describe('UserItemComponent', () => {
  let fixture: ComponentFixture<UserItemComponent>;
  let component: UserItemComponent;
  let httpMock: HttpTestingController;
  let toastService: ToastService;
  let dialogService: ConfirmDialogService;

  const subA = buildSubOrg({ id: 'sub-a', name: 'Sub A', organisationId: 'org-1' });
  const subB = buildSubOrg({ id: 'sub-b', name: 'Sub B', organisationId: 'org-1' });
  const orgWithSubs = buildOrg({
    id: 'org-1',
    name: 'Org 1',
    subOrganisations: [subA, subB],
  });
  const otherOrg = buildOrg({ id: 'org-2', name: 'Org 2', subOrganisations: [] });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserItemComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    toastService = TestBed.inject(ToastService);
    dialogService = TestBed.inject(ConfirmDialogService);

    fixture = TestBed.createComponent(UserItemComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  function setup(user = buildUser(), orgs = [orgWithSubs, otherOrg]) {
    component.user = user;
    component.orgs = orgs;
    fixture.detectChanges();
  }

  it('builds the form from the given user', () => {
    const user = buildUser({
      firstName: 'Max',
      lastName: 'Muster',
      role: Role.User,
      organisationId: 'org-1',
      subOrganisations: [subA],
    });
    setup(user);

    expect(component.form.value).toEqual(
      jasmine.objectContaining({
        firstName: 'Max',
        lastName: 'Muster',
        role: Role.User,
        organisationId: 'org-1',
        subOrganisationIds: ['sub-a'],
      }),
    );
  });

  it('does not require an organisation for a plain User', () => {
    setup(buildUser({ role: Role.User, organisationId: null }));

    expect(component.form.get('organisationId')?.valid).toBeTrue();
  });

  it('requires an organisation once the role is switched to OrgController', () => {
    setup(buildUser({ role: Role.User, organisationId: null }));

    component.form.get('role')?.setValue(Role.OrgController);

    expect(component.form.get('organisationId')?.hasError('required')).toBeTrue();
  });

  it('requires an organisation and at least one sub-organisation for SubOrgCoordinator', () => {
    setup(buildUser({ role: Role.User, organisationId: null }));

    component.form.get('role')?.setValue(Role.SubOrgCoordinator);

    expect(component.form.get('organisationId')?.hasError('required')).toBeTrue();
    expect(
      component.form.get('subOrganisationIds')?.hasError('required'),
    ).toBeTrue();

    component.form.get('subOrganisationIds')?.setValue(['sub-a']);
    expect(component.form.get('subOrganisationIds')?.valid).toBeTrue();
  });

  it('drops selected sub-organisations that do not belong to the newly chosen organisation', () => {
    setup(
      buildUser({
        organisationId: 'org-1',
        subOrganisations: [subA, subB],
      }),
    );
    expect(component.form.get('subOrganisationIds')?.value).toEqual([
      'sub-a',
      'sub-b',
    ]);

    component.form.get('organisationId')?.setValue('org-2');

    expect(component.form.get('subOrganisationIds')?.value).toEqual([]);
  });

  it('availableSubOrgs returns the sub-organisations of the matching org, or [] if unknown', () => {
    setup(buildUser({ organisationId: 'org-1' }));

    expect(component.availableSubOrgs('org-1')).toEqual([subA, subB]);
    expect(component.availableSubOrgs('does-not-exist')).toEqual([]);
    // defaults to the form's current organisationId when no arg is given
    expect(component.availableSubOrgs()).toEqual([subA, subB]);
  });

  it('selectedSubOrgs returns only the sub-orgs whose ids are selected', () => {
    setup(
      buildUser({ organisationId: 'org-1', subOrganisations: [subA] }),
    );

    expect(component.selectedSubOrgs()).toEqual([subA]);
  });

  it('onSubOrgsChange updates the form value and marks it dirty', () => {
    setup(buildUser({ organisationId: 'org-1', subOrganisations: [] }));
    expect(component.form.dirty).toBeFalse();

    component.onSubOrgsChange([subB]);

    expect(component.form.get('subOrganisationIds')?.value).toEqual(['sub-b']);
    expect(component.form.dirty).toBeTrue();
  });

  it('save() does nothing while the form is pristine', () => {
    setup();

    component.save();

    expect(httpMock.match(() => true).length).toBe(0);
  });

  it('save() sends the update, connecting the chosen organisation, and shows a success toast', () => {
    const user = buildUser({ id: 'user-1', organisationId: null });
    setup(user);
    component.form.patchValue({ organisationId: 'org-1' });
    component.form.markAsDirty();

    component.save();

    const req = httpMock.expectOne((r) => r.url.includes('/user/i/user-1'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.organisation).toEqual({ connect: { id: 'org-1' } });
    req.flush(user);

    expect(toastService.toasts().length).toBe(1);
    expect(toastService.toasts()[0].severity).toBe('success');
    expect(component.form.pristine).toBeTrue();
  });

  it('save() disconnects the organisation when none is selected', () => {
    const user = buildUser({ id: 'user-1', organisationId: 'org-1' });
    setup(user);
    component.form.patchValue({ organisationId: null });
    component.form.markAsDirty();

    component.save();

    const req = httpMock.expectOne((r) => r.url.includes('/user/i/user-1'));
    expect(req.request.body.organisation).toEqual({ disconnect: true });
    req.flush(user);
  });

  it('delete() opens a confirm dialog and deletes the user once confirmed', () => {
    const user = buildUser({
      id: 'user-1',
      firstName: 'Max',
      lastName: 'Muster',
    });
    setup(user);

    component.delete();

    expect(dialogService.openDialogs().length).toBe(1);
    expect(dialogService.openDialogs()[0].title).toContain('Max Muster');

    dialogService.openDialogs()[0].confirmAction();

    const req = httpMock.expectOne((r) => r.url.includes('/user/i/user-1'));
    expect(req.request.method).toBe('DELETE');
    req.flush(user);

    expect(toastService.toasts().length).toBe(1);
    expect(toastService.toasts()[0].title).toBe('Benutzer gelöscht');
  });
});
