import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { SelectOtherModalComponent } from './select-other-modal';

describe('SelectOtherModal', () => {
  let component: SelectOtherModalComponent;
  let fixture: ComponentFixture<SelectOtherModalComponent>;
  let activeModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    activeModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [SelectOtherModalComponent],
      providers: [{ provide: NgbActiveModal, useValue: activeModal }],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectOtherModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectOption', { id: 1, text: 'Sonstiges', isOpen: true });
    fixture.componentRef.setInput('answer', { answerText: 'existing' });
    fixture.detectChanges();
  });

  it('should create and seed the value from the existing answer', () => {
    expect(component).toBeTruthy();
    expect(component.value()).toBe('existing');
  });

  it('closes with the entered value on save', () => {
    component.onChange({ currentTarget: { value: 'new value' } } as unknown as Event);
    component.save();

    expect(activeModal.close).toHaveBeenCalledWith({ reason: 'save', value: 'new value' });
  });

  it('closes with a cancel reason on cancel', () => {
    component.cancel();

    expect(activeModal.close).toHaveBeenCalledWith({ reason: 'cancel' });
  });

  it('defaults the value to an empty string when there is no existing answer text', () => {
    const freshFixture = TestBed.createComponent(SelectOtherModalComponent);
    freshFixture.componentRef.setInput('selectOption', { id: 1, text: 'Sonstiges', isOpen: true });
    freshFixture.componentRef.setInput('answer', {});
    freshFixture.detectChanges();

    expect(freshFixture.componentInstance.value()).toBe('');
  });
});
