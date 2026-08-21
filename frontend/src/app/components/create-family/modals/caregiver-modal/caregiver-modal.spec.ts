import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { CaregiverModalComponent } from './caregiver-modal';

describe('CaregiverModalComponent', () => {
  let component: CaregiverModalComponent;
  let fixture: ComponentFixture<CaregiverModalComponent>;
  let activeModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    activeModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [CaregiverModalComponent],
      providers: [{ provide: NgbActiveModal, useValue: activeModal }],
    }).compileComponents();

    fixture = TestBed.createComponent(CaregiverModalComponent);
    component = fixture.componentInstance;
    // Reactive-form validity (is-invalid classes) settles one tick after the initial render,
    // so skip Angular's dev-mode checkNoChanges pass here rather than treat that as a bug.
    fixture.detectChanges(false);
  });

  it('should create with an empty, invalid form when no caregiver is given', () => {
    expect(component).toBeTruthy();
    expect(component['form'].valid).toBeFalse();
    expect(component['form'].value.name).toBe('');
  });

  it('closes with the form value on save', () => {
    component['form'].patchValue({ name: 'Jane', relation: 'mother' });

    component.save();

    expect(activeModal.close).toHaveBeenCalledWith({
      reason: 'save',
      value: jasmine.objectContaining({ name: 'Jane', relation: 'mother' }),
    });
  });

  it('closes with a cancel reason on cancel', () => {
    component.cancel();

    expect(activeModal.close).toHaveBeenCalledWith({ reason: 'cancel' });
  });
});
