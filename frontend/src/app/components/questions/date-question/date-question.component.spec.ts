import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateQuestionComponent } from './date-question.component';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('DateQuestionComponent', () => {
  let component: DateQuestionComponent;
  let fixture: ComponentFixture<DateQuestionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DateQuestionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DateQuestionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('question', buildQuestion());
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('is invalid when required and unanswered', () => {
    fixture.componentRef.setInput('question', buildQuestion({ required: true }));
    fixture.detectChanges();

    expect(component.answerValid).toBeFalse();
    expect(component.reason).toContain('nicht optional');
  });

  it('becomes valid and updates the answer when a date is selected', () => {
    const question = buildQuestion({ required: true });
    fixture.componentRef.setInput('question', question);
    fixture.detectChanges();

    component.onDateSelect({ year: 2026, month: 3, day: 15 });

    expect(component.answerValid).toBeTrue();
    expect(component.answer()?.answerDate).toEqual(new Date(2026, 2, 15));
    expect(component.answer()?.questionId).toBe(question.id);
  });

  it('is valid when not required and unanswered', () => {
    fixture.componentRef.setInput('question', buildQuestion({ required: false }));
    fixture.detectChanges();

    expect(component.answerValid).toBeTrue();
    expect(component.reason).toBe('');
  });

  it('seeds the model from an existing answer date', () => {
    fixture.componentRef.setInput('question', buildQuestion());
    fixture.componentRef.setInput('answer', { answerDate: new Date(2026, 2, 15) });
    fixture.detectChanges();

    expect(component.model()).toEqual({ year: 2026, month: 3, day: 15 });
  });

  it('toNgbDateStruct falls back to today when given no date', () => {
    fixture.componentRef.setInput('question', buildQuestion());
    fixture.detectChanges();
    const today = new Date();

    const struct = component.toNgbDateStruct(undefined);

    expect(struct).toEqual({
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
    });
  });
});
