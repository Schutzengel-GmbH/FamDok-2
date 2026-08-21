import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { StatsCardDynamicComponent } from './stats-card-dynamic.component';
import { buildQuestion } from 'src/app/testing/fixtures';
import { QuestionType } from '../../../../../../shared/generated/prisma/enums';

describe('StatsCardDynamicComponent', () => {
  let component: StatsCardDynamicComponent;
  let fixture: ComponentFixture<StatsCardDynamicComponent>;
  let httpMock: HttpTestingController;

  const dateQuestion = buildQuestion({ id: 'q-date', type: QuestionType.Date, text: 'Datum' });
  const intQuestion = buildQuestion({ id: 'q-int', type: QuestionType.Integer });
  const form = {
    id: 'form-1',
    name: 'Dynamic Form',
    questions: [dateQuestion, intQuestion],
  };

  beforeEach(async () => {
    localStorage.removeItem('STATS_STATE');
    await TestBed.configureTestingModule({
      imports: [StatsCardDynamicComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StatsCardDynamicComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('range', {
      start: new Date('2026-01-01'),
      end: new Date('2026-02-01'),
    });
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('STATS_STATE');
  });

  it('loads eligible forms (with a Date question and a numeric question)', () => {
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/general-form/definitions')).flush([form]);

    expect(component.forms()).toEqual([form] as any);
  });

  it('derives the date question and numeric questions once a form is selected', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.includes('/general-form/definitions')).flush([form]);

    component.selectedForm.set(form as any);

    expect(component.dateQuestion()).toEqual(dateQuestion as any);
    expect(component.questions()).toEqual([intQuestion] as any);
  });

  it('sums the numeric answers for the selected question, treating missing values as 0', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.includes('/general-form/definitions')).flush([form]);

    component.selectedForm.set(form as any);
    component.selectedQuestion.set(intQuestion as any);
    fixture.detectChanges(); // let the constructor effect re-run and issue the responses request

    const responsesReq = httpMock.expectOne((r) => r.url.includes('/general-form/responses'));
    responsesReq.flush([
      { answers: [{ questionId: 'q-int', answerInt: 5 }] },
      { answers: [{ questionId: 'q-int', answerInt: 3 }] },
      { answers: [{ questionId: 'other', answerInt: 100 }] },
    ]);

    expect(component.value()).toBe(8);
  });
});
