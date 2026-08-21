import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { DateQuestionFilter } from './date-question-filter.component';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('DateQuestionFilter', () => {
  let component: DateQuestionFilter;
  let fixture: ComponentFixture<DateQuestionFilter>;
  let modal: jasmine.SpyObj<NgbModal>;

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [DateQuestionFilter],
      providers: [{ provide: NgbModal, useValue: modal }],
    }).compileComponents();
    fixture = TestBed.createComponent(DateQuestionFilter);
    component = fixture.componentInstance;
  });

  function setup(question = buildQuestion({ selectOptions: [{ id: 1, text: 'A' }] })) {
    fixture.componentRef.setInput('question', question);
    fixture.detectChanges();
  }

  it('maps selectOptions into label/value options', () => {
    setup();

    expect(component.options()).toEqual([{ label: 'A', value: 1 }]);
  });

  it('apply emits an empty filter and sets active when no filter input is given', () => {
    setup();
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));

    component.apply();

    expect(component.active()).toBeTrue();
    expect(emitted).toEqual({});
  });

  it('apply emits the built date filter when input is given', () => {
    const question = buildQuestion();
    setup(question);
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));
    const date = new Date('2026-01-01');
    component.filterInput = { filter: 'gte', value: date };

    component.apply();

    expect(emitted).toEqual({ questionId: question.id, answerDate: { gte: date } });
  });

  it('cancel resets the filter and emits an empty filter', () => {
    setup();
    component.filterInput = { filter: 'gte', value: new Date() };
    component.apply();
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));

    component.cancel();

    expect(component.active()).toBeFalse();
    expect(component.filterInput).toBeUndefined();
    expect(emitted).toEqual({});
  });

  describe('open', () => {
    it('applies the filter when the modal resolves with "apply"', async () => {
      setup();
      modal.open.and.returnValue({ result: Promise.resolve('apply') } as any);
      const applySpy = spyOn(component, 'apply');

      component.open({} as any);
      await fixture.whenStable();

      expect(applySpy).toHaveBeenCalled();
    });

    it('cancels the filter when the modal resolves with anything else', async () => {
      setup();
      modal.open.and.returnValue({ result: Promise.resolve('dismiss') } as any);
      const cancelSpy = spyOn(component, 'cancel');

      component.open({} as any);
      await fixture.whenStable();

      expect(cancelSpy).toHaveBeenCalled();
    });
  });
});
