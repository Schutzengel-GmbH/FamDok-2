import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Location } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import Keycloak from 'keycloak-js';

import { CreateFamilyComponent } from './create-family.component';
import { ToastService } from 'src/app/services/toast.service';
import { buildUser } from 'src/app/testing/fixtures';
import { flushSettings } from 'src/app/testing/http-helpers';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { environment } from 'src/environments/environment';

describe('CreateFamilyComponent', () => {
  let component: CreateFamilyComponent;
  let fixture: ComponentFixture<CreateFamilyComponent>;
  let httpMock: HttpTestingController;
  let modal: jasmine.SpyObj<NgbModal>;
  let location: jasmine.SpyObj<Location>;
  let toast: ToastService;

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);
    location = jasmine.createSpyObj('Location', ['back']);

    await TestBed.configureTestingModule({
      imports: [CreateFamilyComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NgbModal, useValue: modal },
        { provide: Location, useValue: location },
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(CreateFamilyComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  /** Flushes the /settings (via CaseService) and /me (via MeService) requests that fire as
   * soon as the component is constructed. */
  function flushBootstrap(user = buildUser({ organisationId: 'org-1' })) {
    flushSettings(httpMock);
    httpMock.match((r) => r.url.includes('/me')).forEach((r) => r.flush(user));
    return user;
  }

  it('disables the form and shows an error when the user has no organisation', () => {
    flushBootstrap(buildUser({ organisationId: null as any }));
    fixture.detectChanges();

    expect(component['errorMessage']).toContain('keiner Organisation');
    expect(component['form'].disabled).toBeTrue();
  });

  it('leaves the form enabled for a user with an organisation', () => {
    flushBootstrap();
    fixture.detectChanges();

    expect(component['errorMessage']).toBeNull();
    expect(component['form'].enabled).toBeTrue();
  });

  it('reports required/minlength/pattern errors with German messages', () => {
    flushBootstrap();
    fixture.detectChanges();

    component['name'].markAsTouched();
    expect(component['getFieldError'](component['name'], 'Name')).toBe(
      'Name ist erforderlich.',
    );

    component['name'].setValue('a');
    expect(component['getFieldError'](component['name'], 'Name')).toContain(
      'mindestens',
    );

    component['plz'].markAsTouched();
    component['plz'].setValue('abc');
    expect(component['getFieldError'](component['plz'], 'PLZ')).toBe(
      'PLZ hat ein ungültiges Format.',
    );
  });

  it('returns null for an untouched or valid control', () => {
    flushBootstrap();
    fixture.detectChanges();

    expect(component['getFieldError'](component['name'], 'Name')).toBeNull();
    component['name'].setValue('Valid Name');
    component['name'].markAsTouched();
    expect(component['getFieldError'](component['name'], 'Name')).toBeNull();
  });

  it('adds a new child from the modal result and can delete it again', () => {
    flushBootstrap();
    fixture.detectChanges();
    const child = { name: 'Max', lastName: 'Muster' } as any;
    modal.open.and.returnValue({
      componentInstance: {},
      closed: { subscribe: (cb: any) => cb({ reason: 'save', value: child }) },
    } as any);

    component.handleOpenChild();

    expect(component['children']).toEqual([child]);

    component.deleteChild(0);
    expect(component['children']).toEqual([]);
  });

  it('replaces an existing child in place when editing by index', () => {
    flushBootstrap();
    fixture.detectChanges();
    component['children'] = [{ name: 'Old' } as any];
    const updated = { name: 'New' } as any;
    modal.open.and.returnValue({
      componentInstance: {},
      closed: { subscribe: (cb: any) => cb({ reason: 'save', value: updated }) },
    } as any);

    component.handleOpenChild(0);

    expect(component['children']).toEqual([updated]);
  });

  it('does not add a child when the modal is cancelled', () => {
    flushBootstrap();
    fixture.detectChanges();
    modal.open.and.returnValue({
      componentInstance: {},
      closed: { subscribe: (cb: any) => cb({ reason: 'cancel' }) },
    } as any);

    component.handleOpenChild();

    expect(component['children']).toEqual([]);
  });

  it('adds a new caregiver and can delete it again', () => {
    flushBootstrap();
    fixture.detectChanges();
    const caregiver = { name: 'Anna' } as any;
    modal.open.and.returnValue({
      componentInstance: {},
      closed: { subscribe: (cb: any) => cb({ reason: 'save', value: caregiver }) },
    } as any);

    component.handleOpenCaregiver();
    expect(component['caregivers']).toEqual([caregiver]);

    component.deleteCaregiver(0);
    expect(component['caregivers']).toEqual([]);
  });

  it('reports the correct Familienstand label and selection state', () => {
    flushBootstrap();
    fixture.detectChanges();

    expect(component.familienstandString('ledig')).toBe('Ledig');
    expect(component.familienstandString('verheiratet')).toBe('Verheiratet');
    expect(component.familienstandString('geschieden')).toBe('Geschieden');
    expect(component.familienstandString('unspecified')).toBe('Keine Angabe');

    component['familienstand'].setValue('ledig' as any);
    expect(component.familienstandSelected('ledig')).toBeTrue();
    expect(component.familienstandSelected('verheiratet')).toBeFalse();
  });

  it('does not submit an invalid form', () => {
    flushBootstrap();
    fixture.detectChanges();

    component['onSubmit']();

    expect(httpMock.match(() => true).length).toBe(0);
  });

  it('submits a valid form, resets state, navigates back and shows a success toast', () => {
    const user = flushBootstrap();
    fixture.detectChanges();

    component['name'].setValue('Musterfamilie');
    component['street'].setValue('Hauptstr.');
    component['number'].setValue('1');
    component['plz'].setValue('12345');
    component['city'].setValue('Berlin');
    component['startedAt'].setValue(new Date('2024-01-01'));
    component['children'] = [{ name: 'Kind' } as any];
    component['caregivers'] = [{ name: 'Elternteil' } as any];

    expect(component['form'].valid).toBeTrue();

    component['onSubmit']();

    const familyReq = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/family` && r.method === 'POST',
    );
    expect(familyReq.request.body.name).toBe('Musterfamilie');
    expect(familyReq.request.body.organisation).toEqual({
      connect: { id: user.organisationId },
    });
    familyReq.flush({ id: 'family-1' });

    const caseReq = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/case` && r.method === 'POST',
    );
    expect(caseReq.request.body.family).toEqual({ connect: { id: 'family-1' } });
    expect(caseReq.request.body.responsibleUsers).toEqual({
      connect: { id: user.id },
    });
    caseReq.flush({ id: 'case-1' });

    expect(location.back).toHaveBeenCalled();
    expect(component['children']).toEqual([]);
    expect(component['caregivers']).toEqual([]);
    expect(toast.toasts().length).toBe(1);
    expect(toast.toasts()[0].severity).toBe('success');
  });

  it('shows an error message when submitting fails', () => {
    flushBootstrap();
    fixture.detectChanges();

    component['name'].setValue('Musterfamilie');
    component['street'].setValue('Hauptstr.');
    component['number'].setValue('1');
    component['plz'].setValue('12345');
    component['city'].setValue('Berlin');
    component['startedAt'].setValue(new Date('2024-01-01'));

    component['onSubmit']();

    const familyReq = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/family`,
    );
    familyReq.flush('Boom', { status: 500, statusText: 'Server Error' });

    expect(component['isLoading']).toBeFalse();
    expect(component['errorMessage']).toBeTruthy();
  });
});
