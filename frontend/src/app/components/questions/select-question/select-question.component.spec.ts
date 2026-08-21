import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { SelectQuestionComponent } from './select-question.component';
import { SelectMultipleComponent } from './select-multiple/select-multiple';
import { SelectOneComponent } from './select-one/select-one';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('SelectQuestionComponent', () => {
  let component: SelectQuestionComponent;
  let fixture: ComponentFixture<SelectQuestionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectQuestionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectQuestionComponent);
    component = fixture.componentInstance;
  });

  it('renders select-one for a single-answer question', () => {
    fixture.componentRef.setInput('question', buildQuestion({ multiple: false }));
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(SelectOneComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(SelectMultipleComponent))).toBeFalsy();
  });

  it('renders select-multiple for a multi-answer question', () => {
    fixture.componentRef.setInput('question', buildQuestion({ multiple: true }));
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(SelectMultipleComponent))).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(SelectOneComponent))).toBeFalsy();
  });
});
