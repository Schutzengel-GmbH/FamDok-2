import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RadioQuestionComponent } from './radio-question.component';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('RadioQuestionComponent', () => {
  let component: RadioQuestionComponent;
  let fixture: ComponentFixture<RadioQuestionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RadioQuestionComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(RadioQuestionComponent);
    component = fixture.componentInstance;
  });

  it('is invalid when required and unanswered', () => {
    component.question = buildQuestion({ required: true }) as any;
    fixture.detectChanges();

    expect(component.answerValid).toBeFalse();
    expect(component.reason).toContain('nicht optional');
  });

  it('becomes valid and updates the answer when an option is selected', () => {
    component.question = buildQuestion({ required: true }) as any;
    fixture.detectChanges();

    component.onSelect(2);

    expect(component.answerValid).toBeTrue();
    expect(component.answer()).toEqual({ answerSelectId: [2] });
    expect(component.selected()).toBe(2);
  });
});
