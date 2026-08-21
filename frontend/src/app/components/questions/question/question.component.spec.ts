import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { QuestionComponent } from './question.component';
import { TextQuestionComponent } from '../text-question/text-question.component';
import { DateQuestionComponent } from '../date-question/date-question.component';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('QuestionComponent', () => {
  let component: QuestionComponent;
  let fixture: ComponentFixture<QuestionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(QuestionComponent);
    component = fixture.componentInstance;
  });

  it('renders the text-question component for a Text question', () => {
    fixture.componentRef.setInput('question', buildQuestion({ type: 'Text' }));
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(TextQuestionComponent))).toBeTruthy();
  });

  it('renders the date-question component for a Date question', () => {
    fixture.componentRef.setInput('question', buildQuestion({ type: 'Date' }));
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(DateQuestionComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(TextQuestionComponent))).toBeFalsy();
  });
});
