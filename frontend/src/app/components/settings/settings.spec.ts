import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import Keycloak from 'keycloak-js';

import { Settings } from './settings';
import { NameModalComponent } from './modals/name-modal/name-modal';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { buildUser } from 'src/app/testing/fixtures';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { ToastService } from 'src/app/services/toast.service';
import { Role } from '../../../../../shared/generated/prisma/enums';

describe('Settings', () => {
  let fixture: ComponentFixture<Settings>;
  let component: Settings;
  let httpMock: HttpTestingController;
  let toastService: ToastService;
  let dialogService: ConfirmDialogService;
  let modalService: jasmine.SpyObj<NgbModal>;
  let modalRef: { componentInstance: any; closed: Subject<any> };

  beforeEach(async () => {
    modalRef = { componentInstance: {}, closed: new Subject() };
    modalService = jasmine.createSpyObj('NgbModal', ['open']);
    modalService.open.and.returnValue(modalRef as any);

    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
        { provide: NgbModal, useValue: modalService },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    toastService = TestBed.inject(ToastService);
    dialogService = TestBed.inject(ConfirmDialogService);

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  function flushInitialLoads(
    generalForms: any[] = [],
    caseForms: any[] = [],
    orgs: any[] = [],
    settings: any[] = [],
  ) {
    httpMock
      .expectOne((r) => r.url.includes('/general-form/definitions'))
      .flush(generalForms);
    httpMock
      .expectOne((r) => r.url.includes('/case-form-definition'))
      .flush(caseForms);
    httpMock.expectOne((r) => r.url.includes('/org')).flush(orgs);
    httpMock.expectOne((r) => r.url.includes('/settings')).flush(settings);
  }

  function flushCurrentUser(role: Role) {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.endsWith('/me')).flush(buildUser({ role }));
    fixture.detectChanges();
  }

  it('loads general forms, case forms and orgs on construction', () => {
    const generalForms = [{ id: 'g1', name: 'Allgemein', questions: [] }];
    const caseForms = [{ id: 'c1', name: 'Fallbezogen', questions: [] }];
    const orgs = [{ id: 'org-1', name: 'Org 1', subOrganisations: [] }];

    flushInitialLoads(generalForms, caseForms, orgs);

    expect(component['generalForms']).toEqual(generalForms as any);
    expect(component['caseForms']).toEqual(caseForms as any);
    expect(component['orgs']).toEqual(orgs as any);
  });

  it('falls back to an empty array when a load returns null/undefined', () => {
    httpMock.expectOne((r) => r.url.includes('/general-form/definitions')).flush(
      null as any,
    );
    httpMock.expectOne((r) => r.url.includes('/case-form-definition')).flush(
      null as any,
    );
    httpMock.expectOne((r) => r.url.includes('/org')).flush(null as any);
    httpMock.expectOne((r) => r.url.includes('/settings')).flush([]);

    expect(component['generalForms']).toEqual([]);
    expect(component['caseForms']).toEqual([]);
    expect(component['orgs']).toEqual([]);
  });

  it('shows the admin/organisation section only for Admin users', () => {
    flushInitialLoads();
    flushCurrentUser(Role.Admin);

    expect(fixture.nativeElement.textContent).toContain('Organisationen');
  });

  it('hides the admin/organisation section for non-Admin users', () => {
    flushInitialLoads();
    flushCurrentUser(Role.User);

    expect(fixture.nativeElement.textContent).not.toContain('Organisationen');
  });

  describe('downloads', () => {
    let capturedAnchor: HTMLAnchorElement | undefined;

    beforeEach(() => {
      flushInitialLoads();
      capturedAnchor = undefined;
      const originalCreateElement = document.createElement.bind(document);
      spyOn(document, 'createElement').and.callFake(((tagName: string) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'a') capturedAnchor = el as HTMLAnchorElement;
        return el;
      }) as any);
      spyOn(URL, 'createObjectURL').and.returnValue('blob:mock-url');
      spyOn(URL, 'revokeObjectURL');
      spyOn(HTMLAnchorElement.prototype, 'click');
    });

    it('downloads a general form as a sanitized .json file', () => {
      component.downloadGeneralForm({
        id: 'g1',
        name: 'A/B:C"Form',
        questions: [],
      } as any);

      expect(capturedAnchor?.download).toBe('A_B_C_Form.json');
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('downloads a case form as a .json file', () => {
      component.downloadCaseForm({
        id: 'c1',
        name: 'Fallformular',
        questions: [],
      } as any);

      expect(capturedAnchor?.download).toBe('Fallformular.json');
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
  });

  describe('organisations', () => {
    beforeEach(() => flushInitialLoads());

    it('addOrg opens the name modal and creates the org on save', () => {
      component.addOrg();

      expect(modalService.open).toHaveBeenCalledWith(NameModalComponent);
      expect(modalRef.componentInstance.title).toBe('Organisation hinzufügen');

      modalRef.closed.next({ reason: 'save', value: 'Neue Organisation' });

      const req = httpMock.expectOne((r) => r.url.endsWith('/org'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'Neue Organisation' });
      req.flush({ id: 'org-2', name: 'Neue Organisation' });

      // triggers a reload of the org list
      httpMock.expectOne((r) => r.url.includes('/org')).flush([]);

      expect(toastService.toasts()[0].severity).toBe('success');
    });

    it('addOrg does nothing when the modal is dismissed/cancelled', () => {
      component.addOrg();

      modalRef.closed.next({ reason: 'cancel' });

      expect(httpMock.match((r) => r.method === 'POST').length).toBe(0);
    });

    it('editOrg pre-fills the modal and updates the org on save', () => {
      const org = { id: 'org-1', name: 'Alter Name' } as any;

      component.editOrg(org);

      expect(modalRef.componentInstance.name).toBe('Alter Name');
      modalRef.closed.next({ reason: 'save', value: 'Neuer Name' });

      const req = httpMock.expectOne((r) => r.url.includes('/org/i/org-1'));
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ name: 'Neuer Name' });
      req.flush({ ...org, name: 'Neuer Name' });
      httpMock.expectOne((r) => r.url.includes('/org')).flush([]);

      expect(toastService.toasts()[0].title).toBe('Gespeichert');
    });

    it('deleteOrg asks for confirmation and deletes on confirm', () => {
      const org = { id: 'org-1', name: 'Zu Löschen' } as any;

      component.deleteOrg(org);

      expect(dialogService.openDialogs().length).toBe(1);
      expect(dialogService.openDialogs()[0].style).toBe('danger');

      dialogService.openDialogs()[0].confirmAction();

      const req = httpMock.expectOne((r) => r.url.includes('/org/i/org-1'));
      expect(req.request.method).toBe('DELETE');
      req.flush(org);
      httpMock.expectOne((r) => r.url.includes('/org')).flush([]);

      expect(toastService.toasts()[0].severity).toBe('success');
    });

    it('deleteOrg shows an error toast when the request fails', () => {
      const org = { id: 'org-1', name: 'Zu Löschen' } as any;
      component.deleteOrg(org);
      dialogService.openDialogs()[0].confirmAction();

      const req = httpMock.expectOne((r) => r.url.includes('/org/i/org-1'));
      req.flush('fail', { status: 500, statusText: 'Server Error' });

      expect(toastService.toasts()[0].severity).toBe('danger');
    });

    it('addSubOrg creates a nested sub-organisation on save', () => {
      const org = { id: 'org-1', name: 'Org 1' } as any;

      component.addSubOrg(org);
      modalRef.closed.next({ reason: 'save', value: 'Neue Unter-Org' });

      const req = httpMock.expectOne((r) => r.url.includes('/org/i/org-1'));
      expect(req.request.body).toEqual({
        subOrganisations: { create: { name: 'Neue Unter-Org' } },
      });
      req.flush(org);
      httpMock.expectOne((r) => r.url.includes('/org')).flush([]);
    });

    it('deleteSubOrg asks for confirmation and deletes on confirm', () => {
      const subOrg = {
        id: 'sub-1',
        name: 'Unter Org',
        organisationId: 'org-1',
      } as any;

      component.deleteSubOrg(subOrg);
      dialogService.openDialogs()[0].confirmAction();

      const req = httpMock.expectOne((r) => r.url.includes('/org/i/org-1'));
      expect(req.request.body).toEqual({
        subOrganisations: { delete: { id: 'sub-1' } },
      });
      req.flush({});
      httpMock.expectOne((r) => r.url.includes('/org')).flush([]);
    });
  });

  describe('forms', () => {
    beforeEach(() => flushInitialLoads());

    it('deleteGeneralForm asks for confirmation and deletes on confirm', () => {
      const form = { id: 'g1', name: 'Formular A' } as any;

      component.deleteGeneralForm(form);
      expect(dialogService.openDialogs()[0].style).toBe('danger');

      dialogService.openDialogs()[0].confirmAction();

      const req = httpMock.expectOne((r) =>
        r.url.includes('/general-form/definitions/i/g1'),
      );
      expect(req.request.method).toBe('DELETE');
      req.flush(form);
      httpMock
        .expectOne((r) => r.url.includes('/general-form/definitions'))
        .flush([]);

      expect(toastService.toasts()[0].severity).toBe('success');
    });

    it('deleteCaseForm asks for confirmation and deletes on confirm', () => {
      const form = { id: 'c1', name: 'Formular B' } as any;

      component.deleteCaseForm(form);
      dialogService.openDialogs()[0].confirmAction();

      const req = httpMock.expectOne((r) =>
        r.url.includes('/case-form-definition/i/c1'),
      );
      expect(req.request.method).toBe('DELETE');
      req.flush(form);
      httpMock.expectOne((r) => r.url.includes('/case-form-definition')).flush(
        [],
      );

      expect(toastService.toasts()[0].severity).toBe('success');
    });

    it('deleteCaseForm shows an error toast when the request fails', () => {
      const form = { id: 'c1', name: 'Formular B' } as any;
      component.deleteCaseForm(form);
      dialogService.openDialogs()[0].confirmAction();

      const req = httpMock.expectOne((r) =>
        r.url.includes('/case-form-definition/i/c1'),
      );
      req.flush('fail', { status: 500, statusText: 'Server Error' });

      expect(toastService.toasts()[0].severity).toBe('danger');
    });
  });
});
