import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { GeneralFormEditorComponent } from './general-form-editor';
import { ToastService } from 'src/app/services/toast.service';
import { environment } from 'src/environments/environment';
import { QuestionType } from '../../../../../shared/generated/prisma/enums';

describe('GeneralFormEditorComponent', () => {
  let component: GeneralFormEditorComponent;
  let fixture: ComponentFixture<GeneralFormEditorComponent>;
  let httpMock: HttpTestingController;
  let toast: ToastService;

  function setup(id = '') {
    TestBed.configureTestingModule({
      imports: [GeneralFormEditorComponent],
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
    fixture = TestBed.createComponent(GeneralFormEditorComponent);
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

      const req = httpMock.expectOne(`${environment.apiUrl}/general-form/definitions/i/form-1`);
      req.flush({
        id: 'form-1',
        name: 'Feedback',
        questions: [{ id: 'q-1', type: QuestionType.Text, text: 'Frage?', selectOptions: [] }],
      });

      expect(component['form'].value.name).toBe('Feedback');
      expect(component['questions'].length).toBe(1);
      expect(component['isLoading']).toBeFalse();
    });
  });

  describe('save', () => {
    it('shows an error toast and does not save when the form is invalid', () => {
      setup('');
      fixture.detectChanges();

      component.save();

      expect(httpMock.match(() => true).length).toBe(0);
      expect(toast.toasts()[0].severity).toBe('danger');
    });

    it('creates a new form and navigates away on success', () => {
      setup('');
      fixture.detectChanges();
      component['form'].patchValue({ name: 'Feedback' });
      component['questions'].at(0).patchValue({ text: 'Frage?' });
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      component.save();

      const req = httpMock.expectOne(`${environment.apiUrl}/general-form/definitions`);
      expect(req.request.method).toBe('POST');
      req.flush({ id: 'new-form', name: 'Feedback' });

      expect(component['isSaving']).toBeFalse();
      expect(toast.toasts()[0].severity).toBe('success');
      expect(router.navigate).toHaveBeenCalledWith(['einstellungen']);
    });

    it('updates an existing form when a formId is present', () => {
      setup('form-1');
      fixture.detectChanges();
      httpMock.expectOne(`${environment.apiUrl}/general-form/definitions/i/form-1`).flush({
        id: 'form-1',
        name: 'Feedback',
        questions: [{ id: 'q-1', type: QuestionType.Text, text: 'Frage?', selectOptions: [] }],
      });

      component.save();

      const req = httpMock.expectOne(`${environment.apiUrl}/general-form/definitions/i/form-1`);
      expect(req.request.method).toBe('PUT');
      req.flush({ id: 'form-1', name: 'Feedback' });
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
