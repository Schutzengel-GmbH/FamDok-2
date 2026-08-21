import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import Keycloak from 'keycloak-js';

import { EditContactDocumentation } from './edit-contact-documentation.component';
import { ToastService } from 'src/app/services/toast.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { flushSettings } from 'src/app/testing/http-helpers';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { environment } from 'src/environments/environment';

describe('EditContactDocumentation', () => {
  let component: EditContactDocumentation;
  let fixture: ComponentFixture<EditContactDocumentation>;
  let httpMock: HttpTestingController;
  let toast: ToastService;
  let confirmDialog: ConfirmDialogService;
  let router: Router;

  const testCase: any = {
    id: 'case-1',
    family: { id: 'family-1', name: 'Musterfamilie' },
  };

  const fullDoc = {
    id: 'doc-1',
    caseId: 'case-1',
    date: new Date('2024-02-01'),
    duration: 30,
    artDerBetreuung: { id: 0, text: 'Hausbesuch' },
    beratungsThemenEltern: [],
    beratungsThemenKinder: [],
    beratungsThemenAllgemein: [],
    zusammenfassung: 'Zusammenfassung',
    dokumentation: 'Dokumentation',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditContactDocumentation],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    confirmDialog = TestBed.inject(ConfirmDialogService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(EditContactDocumentation);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  it('builds a populated, valid form from an existing doc', () => {
    fixture.componentRef.setInput('initialCase', testCase);
    fixture.componentRef.setInput('doc', fullDoc);
    fixture.detectChanges();

    expect(component['form'].value.duration).toBe(30);
    expect(component['form'].value.zusammenfassung).toBe('Zusammenfassung');
    expect(component['form'].valid).toBeTrue();
    expect(component['form'].enabled).toBeTrue();
  });

  it('disables the form when read-only', () => {
    fixture.componentRef.setInput('initialCase', testCase);
    fixture.componentRef.setInput('doc', fullDoc);
    fixture.componentRef.setInput('readOnly', true);
    fixture.detectChanges();

    expect(component['form'].disabled).toBeTrue();
  });

  it('builds an empty, invalid form when creating without an existing doc', () => {
    fixture.componentRef.setInput('initialCase', testCase);
    fixture.componentRef.setInput('isNew', true);
    fixture.detectChanges();
    TestBed.tick();
    // The effect below auto-creates a draft documentation as a side effect of isNew being
    // true; flush it so httpMock doesn't complain about a dangling request.
    httpMock.match(() => true).forEach((r) => r.flush({ id: 'draft-1' }));

    expect(component['form'].valid).toBeFalse();
    expect(component['form'].value.duration).toBeNull();
  });

  it('updates an existing documentation and navigates home on save', () => {
    fixture.componentRef.setInput('initialCase', testCase);
    fixture.componentRef.setInput('doc', fullDoc);
    fixture.detectChanges();

    component.save();

    const req = httpMock.expectOne(
      (r) =>
        r.url ===
          `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1` &&
        r.method === 'PUT',
    );
    expect(req.request.body.zusammenfassung).toBe('Zusammenfassung');
    req.flush({ id: 'doc-1' });

    expect(toast.toasts().length).toBe(1);
    expect(toast.toasts()[0].severity).toBe('success');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('creates a new documentation for the initialCase when no doc exists yet', () => {
    fixture.componentRef.setInput('initialCase', testCase);
    fixture.detectChanges();

    component['form'].patchValue({
      date: new Date('2024-02-01'),
      duration: 15,
      artDerBetreuung: { id: 1, text: 'Telefonat' },
      zusammenfassung: 'Z',
      dokumentation: 'D',
    });

    component.save();

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/case/i/case-1/documentation` &&
        r.method === 'POST',
    );
    expect(req.request.body.case).toEqual({ connect: { id: 'case-1' } });
    req.flush({ id: 'doc-2' });

    expect(toast.toasts().length).toBe(1);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('does nothing on save when there is no case to attach the documentation to', () => {
    fixture.detectChanges();
    // With no initialCase, the template renders <app-select-case>, which pulls in
    // CaseService and fires its own bootstrap requests - flush them so the mock stays clean.
    flushSettings(httpMock);
    httpMock.match((r) => r.url.includes('/case/my')).forEach((r) => r.flush([]));

    component.save();

    expect(httpMock.match((r) => r.url.includes('/case/i/')).length).toBe(0);
  });

  it('seeds the case signal from initialCase immediately, before any onCaseChange', () => {
    fixture.componentRef.setInput('initialCase', testCase);
    fixture.detectChanges();

    expect(component['case']()).toEqual(testCase);
  });

  it('updates the case signal when a case is selected via onCaseChange', () => {
    fixture.detectChanges();
    flushSettings(httpMock);
    httpMock.match((r) => r.url.includes('/case/my')).forEach((r) => r.flush([]));

    component.onCaseChange(testCase);

    expect(component['case']()).toEqual(testCase);
  });

  it('opens a confirm dialog and deletes the documentation on confirm', () => {
    fixture.componentRef.setInput('initialCase', testCase);
    fixture.componentRef.setInput('doc', fullDoc);
    fixture.detectChanges();

    component.delete();
    expect(confirmDialog.openDialogs().length).toBe(1);

    confirmDialog.openDialogs()[0].confirmAction();

    const req = httpMock.expectOne(
      (r) =>
        r.url ===
          `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1` &&
        r.method === 'DELETE',
    );
    req.flush({});

    expect(toast.toasts().some((t) => t.title === 'Gelöscht')).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('defaults to the "daten" tab', () => {
    fixture.componentRef.setInput('initialCase', testCase);
    fixture.componentRef.setInput('doc', fullDoc);
    fixture.detectChanges();

    expect(component['activeTab']()).toBe('daten');
  });

  it('switches tabs without saving when the form is untouched', () => {
    fixture.componentRef.setInput('initialCase', testCase);
    fixture.componentRef.setInput('doc', fullDoc);
    fixture.detectChanges();

    component.setActiveTab('dokumentation');

    expect(component['activeTab']()).toBe('dokumentation');
    httpMock.expectNone(
      `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1`,
    );
  });

  it('auto-saves without navigating away when switching tabs with unsaved changes', () => {
    fixture.componentRef.setInput('initialCase', testCase);
    fixture.componentRef.setInput('doc', fullDoc);
    fixture.detectChanges();

    component['form'].patchValue({ zusammenfassung: 'Geändert' });
    component['form'].markAsDirty();

    component.setActiveTab('dokumentation');

    const req = httpMock.expectOne(
      (r) =>
        r.url ===
          `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1` &&
        r.method === 'PUT',
    );
    expect(req.request.body.zusammenfassung).toBe('Geändert');
    req.flush({ id: 'doc-1' });

    expect(component['activeTab']()).toBe('dokumentation');
    expect(component['form'].pristine).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('auto-creates a draft documentation once when isNew is true and a case is known', () => {
    fixture.componentRef.setInput('initialCase', testCase);
    fixture.componentRef.setInput('isNew', true);
    fixture.detectChanges();
    TestBed.tick();

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/case/i/case-1/documentation` &&
        r.method === 'POST',
    );
    req.flush({ id: 'draft-1', caseId: 'case-1' });

    expect(router.navigate).toHaveBeenCalledWith(
      ['contact-documentation', 'case-1', 'draft-1'],
      { replaceUrl: true },
    );
    expect(component['draftCreated']).toBeTrue();
  });
});
