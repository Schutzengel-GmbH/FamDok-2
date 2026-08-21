import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { SelectQuestionFilter } from './select-question-filter.component';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('SelectQuestionFilter', () => {
  let component: SelectQuestionFilter;
  let fixture: ComponentFixture<SelectQuestionFilter>;
  let modal: jasmine.SpyObj<NgbModal>;
  const options = [{ id: 1, text: 'A' }];

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [SelectQuestionFilter],
      providers: [{ provide: NgbModal, useValue: modal }],
    }).compileComponents();
    fixture = TestBed.createComponent(SelectQuestionFilter);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('question', buildQuestion({ selectOptions: options }));
    fixture.detectChanges();
  });

  it('exposes the question select options', () => {
    expect(component.options()).toEqual(options as any);
  });

  it('apply emits an empty filter when nothing is selected', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));

    component.apply();

    expect(component.active()).toBeTrue();
    expect(emitted).toEqual({});
  });

  it('apply emits an answerSelectId "has" filter when an option is selected', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));
    component.filterInput = options[0];

    component.apply();

    expect(emitted).toEqual({
      questionId: jasmine.any(String),
      answerSelectId: { has: 1 },
    });
  });

  it('cancel resets and emits an empty filter', () => {
    component.filterInput = options[0];
    component.apply();
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));

    component.cancel();

    expect(component.active()).toBeFalse();
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
