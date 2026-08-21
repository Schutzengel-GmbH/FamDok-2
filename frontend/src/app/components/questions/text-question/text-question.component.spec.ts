import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TextQuestionComponent } from './text-question.component';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('TextQuestionComponent', () => {
  let component: TextQuestionComponent;
  let fixture: ComponentFixture<TextQuestionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextQuestionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TextQuestionComponent);
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

    component.onChange({ target: { value: 'hello' } } as unknown as Event);

    expect(component.answerValid()).toBeTrue();
    expect(component.answer()?.answerText).toBe('hello');
    expect(component.answer()?.questionId).toBe(question.id);
  });
});
