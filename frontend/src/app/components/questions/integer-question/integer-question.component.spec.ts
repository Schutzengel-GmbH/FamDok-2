import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IntegerQuestionComponent } from './integer-question.component';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('IntegerQuestionComponent', () => {
  let component: IntegerQuestionComponent;
  let fixture: ComponentFixture<IntegerQuestionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IntegerQuestionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IntegerQuestionComponent);
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

  it('is invalid when required and empty', () => {
    setup(buildQuestion({ required: true }));

    expect(component.validate('')).toBeFalse();
    expect(component.reason).toContain('nicht optional');
  });

  it('rejects a value above max', () => {
    setup(buildQuestion({ max: 10 }));

    expect(component.validate('20')).toBeFalse();
    expect(component.reason).toContain('kleiner');
  });

  it('accepts a valid value and updates the answer', () => {
    const question = buildQuestion();
    setup(question);

    component.onInput({ target: { value: '7' } } as unknown as Event);

    expect(component.answerValid()).toBeTrue();
    expect(component.answer()?.answerInt).toBe(7);
    expect(component.answer()?.questionId).toBe(question.id);
  });
});
