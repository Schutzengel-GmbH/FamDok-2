import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TextAreaQuestionComponent } from './text-area-question';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('TextAreaQuestionComponent', () => {
  let component: TextAreaQuestionComponent;
  let fixture: ComponentFixture<TextAreaQuestionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextAreaQuestionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TextAreaQuestionComponent);
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

    expect(component.answerValid()).toBeFalse();
    expect(component.reason).toContain('nicht optional');
  });

  it('updates the answer and becomes valid on input', () => {
    const question = buildQuestion({ required: true });
    setup(question);

    component.onChange({ target: { value: 'notes' } } as unknown as Event);

    expect(component.answerValid()).toBeTrue();
    expect(component.answer()?.answerText).toBe('notes');
    expect(component.answer()?.questionId).toBe(question.id);
  });
});
