import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Location } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import Keycloak from 'keycloak-js';

import { EditFamilyComponent } from './edit-family';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { ToastService } from 'src/app/services/toast.service';
import { environment } from 'src/environments/environment';

describe('EditFamily', () => {
  let component: EditFamilyComponent;
  let fixture: ComponentFixture<EditFamilyComponent>;
  let httpMock: HttpTestingController;
  let modal: jasmine.SpyObj<NgbModal>;
  let location: jasmine.SpyObj<Location>;

  const family = {
    id: 'family-1',
    name: 'Muster',
    note: null,
    adress: { street: 'Hauptstr.', number: '1', plz: '12345', city: 'Berlin' },
    phone: null,
    additionalPhones: [],
    caregiver: [{ id: 'cg-1', lastName: 'Muster' }],
    children: [{ id: 'child-1', lastName: 'Muster' }],
    case: {
      city: 'Berlin',
      plz: '12345',
      migrationBackground: false,
      specificMigrationBackground: null,
      familienstand: 'ledig',
      partnerInvolved: false,
      bekanntJA: false,
    },
  };

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);
    location = jasmine.createSpyObj('Location', ['back']);

    await TestBed.configureTestingModule({
      imports: [EditFamilyComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Location, useValue: location },
        { provide: NgbModal, useValue: modal },
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EditFamilyComponent);
    component = fixture.componentInstance;
    component.familyId = family.id;
    fixture.detectChanges(false);
    flushSettings(httpMock);
  });

  afterEach(() => httpMock.verify());

  function loadFamily() {
    httpMock.expectOne((r) => r.url.includes('/family/i/family-1')).flush(family as any);
  }

  it('loads the family and populates the form', () => {
    const req = httpMock.expectOne((r) => r.url.includes('/family/i/family-1'));
    req.flush(family as any);

    expect(component['isLoading']).toBeFalse();
    expect(component['name'].value).toBe('Muster');
    expect(component['street'].value).toBe('Hauptstr.');
    expect(component['isDirty']).toBeFalse();
  });

  it('disables the form when readOnly is set', () => {
    fixture.componentRef.setInput('readOnly', true);
    const req = httpMock.expectOne((r) => r.url.includes('/family/i/family-1'));
    req.flush(family as any);

    expect(component['form'].disabled).toBeTrue();
  });

  it('maps Familienstand values to German labels', () => {
    httpMock.expectOne((r) => r.url.includes('/family/i/family-1')).flush(family as any);

    expect(component.familienstandString('ledig')).toBe('Ledig');
    expect(component.familienstandString('verheiratet')).toBe('Verheiratet');
    expect(component.familienstandString('geschieden')).toBe('Geschieden');
    expect(component.familienstandString('unspecified')).toBe('Keine Angabe');
  });

  it('familienstandSelected reports whether the given value is the current form value', () => {
    loadFamily();

    expect(component.familienstandSelected('ledig')).toBeTrue();
    expect(component.familienstandSelected('verheiratet')).toBeFalse();
  });

  describe('child modal', () => {
    it('handleOpenChild does nothing when readOnly', () => {
      fixture.componentRef.setInput('readOnly', true);
      loadFamily();

      component.handleOpenChild();

      expect(modal.open).not.toHaveBeenCalled();
    });

    it('opens the modal with an empty child prefilled with the family surname when adding new', () => {
      loadFamily();
      const closed = { subscribe: () => {} };
      const componentInstance: any = {};
      modal.open.and.returnValue({ componentInstance, closed } as any);

      component.handleOpenChild();

      expect(componentInstance.child).toEqual({ lastName: 'Muster' });
    });

    it('opens the modal with the existing child when editing by index', () => {
      loadFamily();
      const closed = { subscribe: () => {} };
      const componentInstance: any = {};
      modal.open.and.returnValue({ componentInstance, closed } as any);

      component.handleOpenChild(0);

      expect(componentInstance.child).toEqual(
        jasmine.objectContaining({ id: 'child-1' }),
      );
    });

    it('adds a new child and marks the lists dirty on save', () => {
      loadFamily();
      const newChild = { lastName: 'Muster', firstName: 'Neu' };
      const closed = {
        subscribe: (cb: any) => cb({ reason: 'save', value: newChild }),
      };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component.handleOpenChild();

      expect(component['children'].length).toBe(2);
      expect(component['children'][1]).toEqual(newChild as any);
      expect(component['listsDirty']).toBeTrue();
    });

    it('replaces an existing child and marks the lists dirty on save', () => {
      loadFamily();
      const updated = { id: 'child-1', lastName: 'Muster', firstName: 'Geändert' };
      const closed = {
        subscribe: (cb: any) => cb({ reason: 'save', value: updated }),
      };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component.handleOpenChild(0);

      expect(component['children'][0]).toEqual(updated as any);
      expect(component['listsDirty']).toBeTrue();
    });

    it('does nothing when the child modal is cancelled', () => {
      loadFamily();
      const closed = { subscribe: (cb: any) => cb({ reason: 'cancel' }) };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component.handleOpenChild();

      expect(component['children'].length).toBe(1);
      expect(component['listsDirty']).toBeFalse();
    });

    it('deleteChild does nothing when readOnly', () => {
      fixture.componentRef.setInput('readOnly', true);
      loadFamily();

      component.deleteChild(0);

      expect(component['listsDirty']).toBeFalse();
    });

    it('deleteChild removes the child and marks the lists dirty', () => {
      loadFamily();

      component.deleteChild(0);

      expect(component['children'].length).toBe(0);
      expect(component['listsDirty']).toBeTrue();
    });
  });

  describe('caregiver modal', () => {
    it('handleOpenCaregiver does nothing when readOnly', () => {
      fixture.componentRef.setInput('readOnly', true);
      loadFamily();

      component.handleOpenCaregiver();

      expect(modal.open).not.toHaveBeenCalled();
    });

    it('opens the modal with the existing caregiver when editing by index', () => {
      loadFamily();
      const closed = { subscribe: () => {} };
      const componentInstance: any = {};
      modal.open.and.returnValue({ componentInstance, closed } as any);

      component.handleOpenCaregiver(0);

      expect(componentInstance.caregiver).toEqual(
        jasmine.objectContaining({ id: 'cg-1' }),
      );
    });

    it('adds a new caregiver and marks the lists dirty on save', () => {
      loadFamily();
      const newCaregiver = { lastName: 'Muster', firstName: 'Neu' };
      const closed = {
        subscribe: (cb: any) => cb({ reason: 'save', value: newCaregiver }),
      };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component.handleOpenCaregiver();

      expect(component['caregivers'].length).toBe(2);
      expect(component['listsDirty']).toBeTrue();
    });

    it('deleteCaregiver does nothing when readOnly', () => {
      fixture.componentRef.setInput('readOnly', true);
      loadFamily();

      component.deleteCaregiver(0);

      expect(component['listsDirty']).toBeFalse();
    });

    it('deleteCaregiver removes the caregiver and marks the lists dirty', () => {
      loadFamily();

      component.deleteCaregiver(0);

      expect(component['caregivers'].length).toBe(0);
      expect(component['listsDirty']).toBeTrue();
    });
  });

  describe('onSubmit', () => {
    it('does nothing when readOnly', () => {
      fixture.componentRef.setInput('readOnly', true);
      loadFamily();

      component.onSubmit();

      expect(httpMock.match((r) => r.method === 'PUT').length).toBe(0);
    });

    it('sends undefined for every unchanged field', () => {
      loadFamily();

      component.onSubmit();

      const req = httpMock.expectOne(`${environment.apiUrl}/family/i/family-1`);
      expect(req.request.body.name).toBeUndefined();
      expect(req.request.body.case.update.familienstand).toBeUndefined();
      req.flush(family as any);
    });

    it('sends the changed values and shows a success toast on save', () => {
      loadFamily();
      const toast = TestBed.inject(ToastService);
      component['name'].setValue('Neuer Name');
      component['city'].setValue('Hamburg');
      component['familienstand'].setValue('verheiratet' as any);

      component.onSubmit();

      const req = httpMock.expectOne(`${environment.apiUrl}/family/i/family-1`);
      expect(req.request.body.name).toBe('Neuer Name');
      expect(req.request.body.case.update.city).toBe('Hamburg');
      expect(req.request.body.case.update.familienstand).toBe('verheiratet');
      req.flush(family as any);

      expect(toast.toasts()[0].severity).toBe('success');
      expect(location.back).toHaveBeenCalled();
    });

    it('shows an error toast when saving fails', () => {
      loadFamily();
      const toast = TestBed.inject(ToastService);

      component.onSubmit();

      httpMock
        .expectOne(`${environment.apiUrl}/family/i/family-1`)
        .flush('Boom', { status: 500, statusText: 'Server Error' });

      expect(toast.toasts()[0].severity).toBe('danger');
      expect(location.back).not.toHaveBeenCalled();
    });
  });

  it('onReset re-initializes the form from the originally loaded family', () => {
    loadFamily();
    component['name'].setValue('Geändert');

    component.onReset();

    expect(component['name'].value).toBe('Muster');
    expect(component['isDirty']).toBeFalse();
  });
});
