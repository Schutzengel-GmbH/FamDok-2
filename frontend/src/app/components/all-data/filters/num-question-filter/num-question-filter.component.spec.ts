import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { NumQuestionFilter } from './num-question-filter.component';
import { buildQuestion } from 'src/app/testing/fixtures';
import { QuestionType } from '../../../../../../../shared/generated/prisma/enums';

describe('NumQuestionFilter', () => {
  let component: NumQuestionFilter;
  let fixture: ComponentFixture<NumQuestionFilter>;
  let modal: jasmine.SpyObj<NgbModal>;

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [NumQuestionFilter],
      providers: [{ provide: NgbModal, useValue: modal }],
    }).compileComponents();
    fixture = TestBed.createComponent(NumQuestionFilter);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('question', buildQuestion({ type: QuestionType.Integer }));
    fixture.detectChanges();
  });

  it('apply emits an empty filter when no input is given', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));

    component.apply();

    expect(component.active()).toBeTrue();
    expect(emitted).toEqual({});
  });

  it('apply emits the built number filter when input is given', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));
    component.filterInput = { filter: 'gte', value: 5 };

    component.apply();

    expect(emitted).toEqual(
      jasmine.objectContaining({ answerInt: { gte: 5 } }),
    );
  });

  it('cancel resets and emits an empty filter', () => {
    component.filterInput = { filter: 'gte', value: 5 };
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
      modal.open.and.returnValue({ result: Promise.resolve('apply') } as any);
      const applySpy = spyOn(component, 'apply');

      component.open({} as any);
      await fixture.whenStable();

      expect(applySpy).toHaveBeenCalled();
    });

    it('cancels the filter when the modal resolves with anything else', async () => {
      modal.open.and.returnValue({ result: Promise.resolve('dismiss') } as any);
      const cancelSpy = spyOn(component, 'cancel');

      component.open({} as any);
      await fixture.whenStable();

      expect(cancelSpy).toHaveBeenCalled();
    });
  });
});
