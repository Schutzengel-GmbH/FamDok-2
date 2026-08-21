import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';

import { QuestionEditorComponent } from './question-editor';
import { QuestionType } from '../../../../../shared/generated/prisma/enums';

describe('QuestionEditorComponent', () => {
  let component: QuestionEditorComponent;
  let fixture: ComponentFixture<QuestionEditorComponent>;
  let fb: FormBuilder;

  function buildQuestionGroup(type: QuestionType): FormGroup {
    return fb.group({
      type: [type],
      selectOptions: fb.array<FormGroup>([]),
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionEditorComponent],
    }).compileComponents();
    fb = TestBed.inject(FormBuilder);
    fixture = TestBed.createComponent(QuestionEditorComponent);
    component = fixture.componentInstance;
  });

  it('exposes the select options FormArray from the question group', () => {
    component.questionGroup = buildQuestionGroup(QuestionType.Select);
    const options = component.questionGroup.get('selectOptions') as FormArray<FormGroup>;

    expect(component.selectOptions).toBe(options);
  });

  it('reads the current type from the question group', () => {
    component.questionGroup = buildQuestionGroup(QuestionType.Integer);

    expect(component.type).toBe(QuestionType.Integer);
  });

  describe('numberStep', () => {
    it('is "any" for Float questions', () => {
      component.questionGroup = buildQuestionGroup(QuestionType.Float);

      expect(component.numberStep).toBe('any');
    });

    it('is "1" for non-Float questions', () => {
      component.questionGroup = buildQuestionGroup(QuestionType.Integer);

      expect(component.numberStep).toBe('1');
    });
  });

  describe('typeLabel', () => {
    it('maps each question type to its German label', () => {
      component.questionGroup = buildQuestionGroup(QuestionType.Text);

      expect(component.typeLabel(QuestionType.Text)).toBe('Text');
      expect(component.typeLabel(QuestionType.Integer)).toBe('Ganzzahl');
      expect(component.typeLabel(QuestionType.Float)).toBe('Kommazahl');
      expect(component.typeLabel(QuestionType.Date)).toBe('Datum');
      expect(component.typeLabel(QuestionType.Select)).toBe('Auswahl');
      expect(component.typeLabel(QuestionType.Textarea)).toBe('Mehrzeiliger Text');
    });
  });
});
