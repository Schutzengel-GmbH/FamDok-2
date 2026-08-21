import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { GeneralFormPage } from './general-form-page';
import { buildQuestion, buildAnswer } from 'src/app/testing/fixtures';
import { ToastService } from 'src/app/services/toast.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { environment } from 'src/environments/environment';

describe('GeneralFormPage', () => {
  let component: GeneralFormPage;
  let fixture: ComponentFixture<GeneralFormPage>;
  let httpMock: HttpTestingController;

  function setup(params: Record<string, string>, queryParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [GeneralFormPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(params),
              queryParamMap: convertToParamMap(queryParams),
            },
          },
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GeneralFormPage);
    component = fixture.componentInstance;
  }

  afterEach(() => httpMock.verify());

  it('loads the form definition for a new response', () => {
    setup({ id: '' }, { definitionId: 'form-1' });
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/general-form/definitions/i/form-1'));
    const definition = { id: 'form-1', name: 'Feedback', questions: [buildQuestion()] };
    req.flush(definition);

    expect(component['form']).toEqual(definition as any);
  });

  it('fails validation when a required question is unanswered', () => {
    setup({ id: '' }, { definitionId: 'form-1' });
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.url.includes('/general-form/definitions/i/form-1'))
      .flush({ id: 'form-1', name: 'Feedback', questions: [buildQuestion({ required: true })] });

    expect(component.validate()).toBeFalse();
  });

  it('passes validation once every required question is answered', () => {
    setup({ id: '' }, { definitionId: 'form-1' });
    fixture.detectChanges();
    const question = buildQuestion({ required: true });
    httpMock
      .expectOne((r) => r.url.includes('/general-form/definitions/i/form-1'))
      .flush({ id: 'form-1', name: 'Feedback', questions: [question] });

    component['answers'][question.id] = buildAnswer({ answerText: 'hi' }) as any;

    expect(component.validate()).toBeTrue();
  });

  it('loads an existing response by id and its form definition', () => {
    setup({ id: 'resp-1' });
    fixture.detectChanges();

    const answer = buildAnswer({ questionId: 'q1', answerText: 'hi' });
    httpMock
      .expectOne((r) => r.url.includes('/general-form/responses/i/resp-1'))
      .flush({ id: 'resp-1', generalFormId: 'form-1', answers: [answer] });
    httpMock
      .expectOne((r) => r.url.includes('/general-form/definitions/i/form-1'))
      .flush({ id: 'form-1', name: 'Feedback', questions: [] });

    expect(component['response']).toEqual(
      jasmine.objectContaining({ id: 'resp-1' }),
    );
    expect(component['answers']['q1']).toEqual(answer as any);
    expect(component['form']).toEqual(
      jasmine.objectContaining({ id: 'form-1' }),
    );
  });

  it('redirects to the error page when the response is not found', () => {
    setup({ id: 'missing' });
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    httpMock
      .expectOne((r) => r.url.includes('/general-form/responses/i/missing'))
      .flush(null);

    expect(router.navigate).toHaveBeenCalledWith(['error'], {
      queryParams: jasmine.objectContaining({ code: '404' }),
    });
  });

  describe('save', () => {
    function setupSaved() {
      setup({ id: '' }, { definitionId: 'form-1' });
      fixture.detectChanges();
      httpMock
        .expectOne((r) => r.url.includes('/general-form/definitions/i/form-1'))
        .flush({ id: 'form-1', name: 'Feedback', questions: [] });
    }

    it('shows a success toast and navigates home on success', () => {
      setupSaved();
      const toast = TestBed.inject(ToastService);
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      component['save']();

      const req = httpMock.expectOne(`${environment.apiUrl}/general-form/responses`);
      req.flush({ id: 'resp-1' });

      expect(toast.toasts()[0].severity).toBe('success');
      expect(router.navigate).toHaveBeenCalledWith(['']);
    });

    it('shows an error toast and navigates to the error page with the HTTP status on failure', () => {
      setupSaved();
      const toast = TestBed.inject(ToastService);
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      component['save']();

      httpMock
        .expectOne(`${environment.apiUrl}/general-form/responses`)
        .flush('Boom', { status: 500, statusText: 'Server Error' });

      expect(toast.toasts()[0].severity).toBe('danger');
      expect(router.navigate).toHaveBeenCalledWith(['error'], {
        queryParams: jasmine.objectContaining({ code: 500 }),
      });
    });
  });

  describe('delete', () => {
    it('does nothing when there is no existing response', () => {
      setup({ id: '' }, { definitionId: 'form-1' });
      fixture.detectChanges();
      httpMock
        .expectOne((r) => r.url.includes('/general-form/definitions/i/form-1'))
        .flush({ id: 'form-1', name: 'Feedback', questions: [] });
      const confirmDialog = TestBed.inject(ConfirmDialogService);

      component['delete']();

      expect(confirmDialog.openDialogs().length).toBe(0);
    });

    it('opens a confirm dialog and deletes the response on confirm', () => {
      setup({ id: 'resp-1' });
      fixture.detectChanges();
      httpMock
        .expectOne((r) => r.url.includes('/general-form/responses/i/resp-1'))
        .flush({ id: 'resp-1', generalFormId: 'form-1', answers: [] });
      httpMock
        .expectOne((r) => r.url.includes('/general-form/definitions/i/form-1'))
        .flush({ id: 'form-1', name: 'Feedback', questions: [] });
      const confirmDialog = TestBed.inject(ConfirmDialogService);
      const toast = TestBed.inject(ToastService);
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      component['delete']();
      expect(confirmDialog.openDialogs().length).toBe(1);
      confirmDialog.openDialogs()[0].confirmAction();

      httpMock
        .expectOne(`${environment.apiUrl}/general-form/responses/i/resp-1`)
        .flush({});

      expect(toast.toasts()[0].severity).toBe('success');
      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });
  });
});
