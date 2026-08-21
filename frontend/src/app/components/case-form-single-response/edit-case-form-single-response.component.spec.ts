import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { EditCaseFormSingleResponse } from './edit-case-form-single-response.component';
import { ToastService } from 'src/app/services/toast.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { buildQuestion, buildAnswer } from 'src/app/testing/fixtures';

describe('EditCaseFormSingleResponse', () => {
  let component: EditCaseFormSingleResponse;
  let fixture: ComponentFixture<EditCaseFormSingleResponse>;
  let httpMock: HttpTestingController;
  let toast: ToastService;
  let confirmDialog: ConfirmDialogService;
  let router: Router;

  const testCase: any = {
    id: 'case-1',
    family: { id: 'family-1', name: 'Musterfamilie', children: [], caregiver: [] },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditCaseFormSingleResponse],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    confirmDialog = TestBed.inject(ConfirmDialogService);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    fixture = TestBed.createComponent(EditCaseFormSingleResponse);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  function setup(caseForm: any) {
    fixture.componentRef.setInput('caseForm', caseForm);
    fixture.componentRef.setInput('case', testCase);
    fixture.detectChanges();
  }

  it('fetches responses on init regardless of the form type', () => {
    const question = buildQuestion();
    const answer = buildAnswer({ questionId: question.id, answerText: 'Hallo' });
    setup({ id: 'form-1', name: 'Formular', type: 'multiple', isPersonal: false, questions: [question] });

    const req = httpMock.expectOne((r) => r.url.includes('/case-form-response'));
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'resp-1', answers: [answer] }]);

    expect(component['answers']).toEqual({ [question.id]: answer });
    expect(component.responseId).toBe('resp-1');
  });

  it('resets to an empty state when no response exists yet', () => {
    setup({ id: 'form-1', name: 'Formular', type: 'single', isPersonal: false, questions: [] });

    httpMock
      .expectOne((r) => r.url.includes('/case-form-response'))
      .flush([]);

    expect(component['answers']).toEqual({});
    expect(component.responseId).toBeUndefined();
  });

  it('saves the collected answers and navigates home on success', () => {
    const question = buildQuestion();
    setup({ id: 'form-1', name: 'Formular', type: 'single', isPersonal: false, questions: [question] });
    httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

    component['answers'] = {
      [question.id]: buildAnswer({ questionId: question.id, answerText: 'X' }) as any,
    };

    component['saveResponse']();

    const req = httpMock.expectOne(
      (r) => r.url.includes('/case-form-response') && r.method === 'POST',
    );
    expect(req.request.body.answers.createMany.data.length).toBe(1);
    req.flush({ id: 'resp-1', case: { family: { name: 'Musterfamilie' } } });

    expect(toast.toasts().length).toBe(1);
    expect(toast.toasts()[0].severity).toBe('success');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('sends the caregiverId (not childId) when the selected person is a caregiver', () => {
    setup({ id: 'form-1', name: 'Formular', type: 'single', isPersonal: true, questions: [] });
    httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

    component.person.set({ id: 'cg-1', relation: 'mother' } as any);
    component['saveResponse']();

    const req = httpMock.expectOne(
      (r) => r.url.includes('/case-form-response') && r.method === 'POST',
    );
    expect(req.request.body.caregiver).toEqual({ connect: { id: 'cg-1' } });
    expect(req.request.body.child).toBeUndefined();
    req.flush({ id: 'resp-1', case: { family: { name: 'Musterfamilie' } } });
  });

  it('sends the childId (not caregiverId) when the selected person is a child', () => {
    setup({ id: 'form-1', name: 'Formular', type: 'single', isPersonal: true, questions: [] });
    httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

    component.person.set({ id: 'child-1', name: 'Kind' } as any);
    component['saveResponse']();

    const req = httpMock.expectOne(
      (r) => r.url.includes('/case-form-response') && r.method === 'POST',
    );
    expect(req.request.body.child).toEqual({ connect: { id: 'child-1' } });
    expect(req.request.body.caregiver).toBeUndefined();
    req.flush({ id: 'resp-1', case: { family: { name: 'Musterfamilie' } } });
  });

  it('updates an existing response instead of creating a new one once a responseId is known', () => {
    setup({ id: 'form-1', name: 'Formular', type: 'single', isPersonal: false, questions: [] });
    httpMock
      .expectOne((r) => r.url.includes('/case-form-response'))
      .flush([{ id: 'resp-1', answers: [] }]);

    component['saveResponse']();

    const req = httpMock.expectOne(
      (r) => r.url.includes('/case-form-response/i/resp-1'),
    );
    expect(req.request.method).toBe('PUT');
    req.flush({ id: 'resp-1', case: { family: { name: 'Musterfamilie' } } });
  });

  it('does nothing on delete when there is no existing response', () => {
    setup({ id: 'form-1', name: 'Formular', type: 'single', isPersonal: false, questions: [] });
    httpMock.expectOne((r) => r.url.includes('/case-form-response')).flush([]);

    component['delete']();

    expect(confirmDialog.openDialogs().length).toBe(0);
  });

  it('deletes the response and navigates home after confirming', () => {
    setup({ id: 'form-1', name: 'Formular', type: 'single', isPersonal: false, questions: [] });
    httpMock
      .expectOne((r) => r.url.includes('/case-form-response'))
      .flush([{ id: 'resp-1', answers: [] }]);

    component['delete']();
    expect(confirmDialog.openDialogs().length).toBe(1);

    confirmDialog.openDialogs()[0].confirmAction();

    const req = httpMock.expectOne((r) =>
      r.url.includes('/case-form-response/i/resp-1'),
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({});

    expect(toast.toasts().some((t) => t.title === 'Gelöscht')).toBeTrue();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
