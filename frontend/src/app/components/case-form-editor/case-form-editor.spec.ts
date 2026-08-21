import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { CaseFormEditorComponent } from './case-form-editor';
import { ToastService } from 'src/app/services/toast.service';
import { environment } from 'src/environments/environment';
import { CaseFormType, QuestionType } from '../../../../../shared/generated/prisma/enums';

describe('CaseFormEditorComponent', () => {
  let component: CaseFormEditorComponent;
  let fixture: ComponentFixture<CaseFormEditorComponent>;
  let httpMock: HttpTestingController;
  let toast: ToastService;

  function setup(id = '') {
    TestBed.configureTestingModule({
      imports: [CaseFormEditorComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id }) } },
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(CaseFormEditorComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => httpMock.verify());

  describe('ngOnInit', () => {
    it('adds a single blank question for a new form', () => {
      setup('');
      fixture.detectChanges();

      expect(component['questions'].length).toBe(1);
    });

    it('loads and populates an existing form', () => {
      setup('form-1');
      fixture.detectChanges();

      const req = httpMock.expectOne(`${environment.apiUrl}/case-form-definition/i/form-1`);
      req.flush({
        id: 'form-1',
        name: 'Erstgespräch',
        type: CaseFormType.multiple,
        containsPersonalData: true,
        isPersonal: false,
        questions: [{ id: 'q-1', type: QuestionType.Text, text: 'Frage?', selectOptions: [] }],
      });

      expect(component['form'].value.name).toBe('Erstgespräch');
      expect(component['questions'].length).toBe(1);
      expect(component['isLoading']).toBeFalse();
    });
  });

  describe('addQuestion / removeQuestion / moveQuestion', () => {
    it('appends a new blank question', () => {
      setup('');
      fixture.detectChanges();

      component.addQuestion();

      expect(component['questions'].length).toBe(2);
    });

    it('removes a question and tracks its id for deletion', () => {
      setup('form-1');
      fixture.detectChanges();
      httpMock.expectOne(`${environment.apiUrl}/case-form-definition/i/form-1`).flush({
        id: 'form-1',
        name: 'Form',
        type: CaseFormType.multiple,
        containsPersonalData: true,
        isPersonal: false,
        questions: [{ id: 'q-1', type: QuestionType.Text, text: 'Frage?', selectOptions: [] }],
      });

      component.removeQuestion(0);

      expect(component['questions'].length).toBe(0);
      expect(component['deletedQuestionIds']).toEqual(['q-1']);
    });

    it('moveQuestion swaps two questions', () => {
      setup('');
      fixture.detectChanges();
      component.addQuestion();
      component['questions'].at(0).patchValue({ text: 'first' });
      component['questions'].at(1).patchValue({ text: 'second' });

      component.moveQuestion(0, 1);

      expect(component['questions'].at(0).value.text).toBe('second');
      expect(component['questions'].at(1).value.text).toBe('first');
    });
  });

  describe('save', () => {
    it('shows an error toast and does not save when the form is invalid', () => {
      setup('');
      fixture.detectChanges();

      component.save();

      expect(httpMock.match(() => true).length).toBe(0);
      expect(toast.toasts().length).toBe(1);
      expect(toast.toasts()[0].severity).toBe('danger');
    });

    it('shows an error toast when a question fails validation', () => {
      setup('');
      fixture.detectChanges();
      component['form'].patchValue({ name: 'Gültiger Name' });
      component['questions'].at(0).patchValue({ type: QuestionType.Select, text: 'Frage?' });

      component.save();

      expect(httpMock.match(() => true).length).toBe(0);
      expect(toast.toasts()[0].text).toContain('Antwortoption');
    });

    it('creates a new form and navigates away on success', () => {
      setup('');
      fixture.detectChanges();
      component['form'].patchValue({ name: 'Gültiger Name' });
      component['questions'].at(0).patchValue({ text: 'Frage?' });
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      component.save();

      const req = httpMock.expectOne(`${environment.apiUrl}/case-form-definition`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 'new-form', name: 'Gültiger Name' });

      expect(component['isSaving']).toBeFalse();
      expect(toast.toasts()[0].severity).toBe('success');
      expect(router.navigate).toHaveBeenCalledWith(['einstellungen']);
    });

    it('updates an existing form when a formId is present', () => {
      setup('form-1');
      fixture.detectChanges();
      httpMock.expectOne(`${environment.apiUrl}/case-form-definition/i/form-1`).flush({
        id: 'form-1',
        name: 'Form',
        type: CaseFormType.multiple,
        containsPersonalData: true,
        isPersonal: false,
        questions: [{ id: 'q-1', type: QuestionType.Text, text: 'Frage?', selectOptions: [] }],
      });

      component.save();

      const req = httpMock.expectOne(`${environment.apiUrl}/case-form-definition/i/form-1`);
      expect(req.request.method).toBe('PUT');
      req.flush({ id: 'form-1', name: 'Form' });
    });

    it('shows an error toast when the save request fails', () => {
      setup('');
      fixture.detectChanges();
      component['form'].patchValue({ name: 'Gültiger Name' });
      component['questions'].at(0).patchValue({ text: 'Frage?' });

      component.save();

      httpMock
        .expectOne(`${environment.apiUrl}/case-form-definition`)
        .flush('error', { status: 500, statusText: 'Server Error' });

      expect(component['isSaving']).toBeFalse();
      expect(toast.toasts()[0].severity).toBe('danger');
    });
  });

  it('cancel navigates back to settings', () => {
    setup('');
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');

    component.cancel();

    expect(router.navigate).toHaveBeenCalledWith(['einstellungen']);
  });
});
