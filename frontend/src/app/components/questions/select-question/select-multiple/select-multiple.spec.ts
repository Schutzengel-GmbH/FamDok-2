import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { SelectMultipleComponent } from './select-multiple';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('SelectMultiple', () => {
  let component: SelectMultipleComponent;
  let fixture: ComponentFixture<SelectMultipleComponent>;
  let modal: jasmine.SpyObj<NgbModal>;

  const options = [
    { id: 1, text: 'Option A' },
    { id: 2, text: 'Option B' },
    { id: 3, text: 'Sonstiges', isOpen: true },
  ];

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [SelectMultipleComponent],
      providers: [{ provide: NgbModal, useValue: modal }],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectMultipleComponent);
    component = fixture.componentInstance;
  });

  function setup(question = buildQuestion({ selectOptions: options })) {
    fixture.componentRef.setInput('question', question);
    fixture.detectChanges();
  }

  it('should create', () => {
    setup();
    expect(component).toBeTruthy();
  });

  it('is invalid when required and unanswered', () => {
    setup(buildQuestion({ required: true, selectOptions: options }));

    expect(component.isAnswerValid()).toBeFalse();
  });

  it('updates the answer on change', () => {
    const question = buildQuestion({ selectOptions: options });
    setup(question);

    component.onChange([options[0]]);

    expect(component.answer()?.answerSelectId).toEqual([1]);
    expect(component.answer()?.questionId).toBe(question.id);
    expect(component.isAnswerValid()).toBeTrue();
  });

  it('compareFn compares by id', () => {
    setup();
    expect(component.compareFn(options[0], { id: 1, text: 'Other label' })).toBeTrue();
    expect(component.compareFn(options[0], options[1])).toBeFalse();
  });

  it('is valid when not required and unanswered', () => {
    setup(buildQuestion({ required: false, selectOptions: options }));

    expect(component.isAnswerValid()).toBeTrue();
  });

  it('is valid when required and answered', () => {
    const question = buildQuestion({ required: true, selectOptions: options });
    setup(question);

    component.onChange([options[0]]);

    expect(component.isAnswerValid()).toBeTrue();
  });

  it('seeds the model from an existing answer', () => {
    const question = buildQuestion({ selectOptions: options });
    fixture.componentRef.setInput('question', question);
    fixture.componentRef.setInput('answer', { answerSelectId: [1, 2] });
    fixture.detectChanges();

    expect(component.model()).toEqual([options[0], options[1]]);
  });

  describe('onAdd / onHandleOpenOption', () => {
    it('does nothing for a regular (non-open) option', () => {
      setup();

      component.onAdd(options[0]);

      expect(modal.open).not.toHaveBeenCalled();
    });

    it('opens the "other" modal for an open option and saves the free-text answer', () => {
      setup();
      const closed = { subscribe: (cb: any) => cb({ reason: 'save', value: 'Custom' }) };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component.onAdd(options[2]);

      expect(modal.open).toHaveBeenCalled();
      expect(component.answer()?.answerText).toBe('Custom');
    });

    it('does not update the answer when the "other" modal is cancelled', () => {
      setup();
      const closed = { subscribe: (cb: any) => cb({ reason: 'cancel' }) };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component.onAdd(options[2]);

      expect(component.answer()?.answerText).toBeUndefined();
    });
  });
});
