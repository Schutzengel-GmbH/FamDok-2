import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { SelectOneComponent } from './select-one';
import { buildQuestion } from 'src/app/testing/fixtures';

describe('SelectOne', () => {
  let component: SelectOneComponent;
  let fixture: ComponentFixture<SelectOneComponent>;
  let modal: jasmine.SpyObj<NgbModal>;

  const options = [
    { id: 1, text: 'Option A' },
    { id: 2, text: 'Option B' },
    { id: 3, text: 'Sonstiges', isOpen: true },
  ];

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [SelectOneComponent],
      providers: [{ provide: NgbModal, useValue: modal }],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectOneComponent);
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

    component.onChange(options[0]);

    expect(component.answer()?.answerSelectId).toEqual([1]);
    expect(component.answer()?.questionId).toBe(question.id);
  });

  it('clears the answer when the selection is removed', () => {
    setup();

    component.onChange(undefined as any);

    expect(component.answer()?.answerSelectId).toEqual([]);
  });

  it('is valid when required and answered', () => {
    const question = buildQuestion({ required: true, selectOptions: options });
    setup(question);

    component.onChange(options[0]);

    expect(component.isAnswerValid()).toBeTrue();
  });

  it('seeds the model from an existing answer', () => {
    const question = buildQuestion({ selectOptions: options });
    fixture.componentRef.setInput('question', question);
    fixture.componentRef.setInput('answer', { answerSelectId: [2] });
    fixture.detectChanges();

    expect(component.model()).toEqual(options[1]);
  });

  describe('onHandleOpenOption', () => {
    it('opens the "other" modal for an open option and saves the free-text answer', () => {
      setup();
      const closed = { subscribe: (cb: any) => cb({ reason: 'save', value: 'Custom' }) };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component.onChange(options[2]);

      expect(modal.open).toHaveBeenCalled();
      expect(component.answer()?.answerText).toBe('Custom');
      expect(component.answer()?.answerSelectId).toEqual([3]);
    });

    it('does not update the answer when the "other" modal is cancelled', () => {
      setup();
      const closed = { subscribe: (cb: any) => cb({ reason: 'cancel' }) };
      modal.open.and.returnValue({ componentInstance: {}, closed } as any);

      component.onChange(options[2]);

      expect(component.answer()?.answerText).toBeUndefined();
    });
  });
});
