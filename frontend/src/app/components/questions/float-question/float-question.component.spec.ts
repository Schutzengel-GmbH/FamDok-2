import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FloatQuestionComponent } from './float-question.component';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('FloatQuestionComponent', () => {
  let component: FloatQuestionComponent;
  let fixture: ComponentFixture<FloatQuestionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FloatQuestionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FloatQuestionComponent);
    component = fixture.componentInstance;
  });

  function setup(question = buildQuestion()) {
    fixture.componentRef.setInput('question', question);
    fixture.detectChanges();
  }

  it('should create', () => {
    setup();
    expect(component).toBeTruthy();
  });

  it('rejects non-numeric input', () => {
    setup();
    component.validate('abc');

    expect(component.answerValid()).toBeFalse();
    expect(component.reason).toContain('Dezimalzahl');
  });

  it('rejects a value above max', () => {
    setup(buildQuestion({ max: 10 }));
    component.validate('20');

    expect(component.answerValid()).toBeFalse();
    expect(component.reason).toContain('kleiner');
  });

  it('accepts a valid value and updates the answer', () => {
    const question = buildQuestion();
    setup(question);

    component.onInput({ target: { value: '4,5' } } as unknown as Event);

    expect(component.answerValid()).toBeTrue();
    expect(component.answer()?.answerNum).toBe(4.5);
    expect(component.answer()?.questionId).toBe(question.id);
  });
});
