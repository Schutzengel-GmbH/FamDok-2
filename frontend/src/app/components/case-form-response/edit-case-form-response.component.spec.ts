import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { EditCaseFormResponse } from './edit-case-form-response.component';
import { ToastService } from 'src/app/services/toast.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { buildQuestion, buildAnswer } from 'src/app/testing/fixtures';

describe('EditCaseFormResponse', () => {
  let component: EditCaseFormResponse;
  let fixture: ComponentFixture<EditCaseFormResponse>;
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
      imports: [EditCaseFormResponse],
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

    fixture = TestBed.createComponent(EditCaseFormResponse);
    component = fixture.componentInstance;
  });

  afterEach(() => httpMock.verify());

  function setup(caseForm: any, response?: any) {
    fixture.componentRef.setInput('caseForm', caseForm);
    fixture.componentRef.setInput('case', testCase);
    if (response !== undefined) fixture.componentRef.setInput('response', response);
    fixture.detectChanges();
  }

  it('does not fetch responses for a form that allows multiple responses', () => {
    setup({ id: 'form-1', name: 'Formular', type: 'multiple', isPersonal: false, questions: [] });

    httpMock.expectNone((r) => r.url.includes('/case-form-response'));
    expect(component.answers()).toEqual({});
  });

  it('fetches and applies the latest response for a single-response form', () => {
    const question = buildQuestion();
    const answer = buildAnswer({ questionId: question.id, answerText: 'Hallo' });
    setup({ id: 'form-1', name: 'Formular', type: 'single', isPersonal: false, questions: [question] });

    const req = httpMock.expectOne((r) => r.url.includes('/case-form-response'));
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'resp-1', answers: [answer] }]);

    expect(component.answers()).toEqual({ [question.id]: answer });
    expect(component.response()?.id).toBe('resp-1');
  });

  it('resets to an empty state when no response exists yet', () => {
    setup({ id: 'form-1', name: 'Formular', type: 'single', isPersonal: false, questions: [] });

    httpMock
      .expectOne((r) => r.url.includes('/case-form-response'))
      .flush([]);

    expect(component.answers()).toEqual({});
    expect(component.response()).toBeUndefined();
  });

  it('derives the answers map from a response passed in as input', () => {
    const question = buildQuestion();
    const answer = buildAnswer({ questionId: question.id, answerInt: 42 });
    setup(
      { id: 'form-1', name: 'Formular', type: 'multiple', isPersonal: false, questions: [question] },
      { id: 'resp-1', answers: [answer] },
    );

    expect(component.answers()).toEqual({ [question.id]: answer });
  });

  it('saves the collected answers and navigates home on success', () => {
    const question = buildQuestion();
    setup({ id: 'form-1', name: 'Formular', type: 'multiple', isPersonal: false, questions: [question] });
    component.answers.set({
      [question.id]: buildAnswer({ questionId: question.id, answerText: 'X' }),
    } as any);

    component['saveResponse']();

    const req = httpMock.expectOne((r) => r.url.includes('/case-form-response'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.answers.createMany.data.length).toBe(1);
    req.flush({ id: 'resp-1', case: { family: { name: 'Musterfamilie' } } });

    expect(toast.toasts().length).toBe(1);
    expect(toast.toasts()[0].severity).toBe('success');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('sends the caregiverId (not childId) when the selected person is a caregiver', () => {
    const question = buildQuestion();
    setup({ id: 'form-1', name: 'Formular', type: 'multiple', isPersonal: true, questions: [question] });
    component.answers.set({});
    component.person.set({ id: 'cg-1', relation: 'mother' } as any);

    component['saveResponse']();

    const req = httpMock.expectOne((r) => r.url.includes('/case-form-response'));
    expect(req.request.body.caregiver).toEqual({ connect: { id: 'cg-1' } });
    expect(req.request.body.child).toBeUndefined();
    req.flush({ id: 'resp-1', case: { family: { name: 'Musterfamilie' } } });
  });

  it('sends the childId (not caregiverId) when the selected person is a child', () => {
    const question = buildQuestion();
    setup({ id: 'form-1', name: 'Formular', type: 'multiple', isPersonal: true, questions: [question] });
    component.answers.set({});
    component.person.set({ id: 'child-1', name: 'Kind' } as any);

    component['saveResponse']();

    const req = httpMock.expectOne((r) => r.url.includes('/case-form-response'));
    expect(req.request.body.child).toEqual({ connect: { id: 'child-1' } });
    expect(req.request.body.caregiver).toBeUndefined();
    req.flush({ id: 'resp-1', case: { family: { name: 'Musterfamilie' } } });
  });

  it('does nothing on delete when there is no existing response', () => {
    setup({ id: 'form-1', name: 'Formular', type: 'multiple', isPersonal: false, questions: [] });

    component['delete']();

    expect(confirmDialog.openDialogs().length).toBe(0);
  });

  it('deletes the response and navigates home after confirming', () => {
    const question = buildQuestion();
    setup({ id: 'form-1', name: 'Formular', type: 'single', isPersonal: false, questions: [question] });
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
    expect(confirmDialog.openDialogs().length).toBe(0);
  });
});
