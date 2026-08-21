import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { ChildModalComponent } from './child-modal';

describe('ChildModalComponent', () => {
  let component: ChildModalComponent;
  let fixture: ComponentFixture<ChildModalComponent>;
  let activeModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    activeModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [ChildModalComponent],
      providers: [{ provide: NgbActiveModal, useValue: activeModal }],
    }).compileComponents();

    fixture = TestBed.createComponent(ChildModalComponent);
    component = fixture.componentInstance;
    // Reactive-form validity (is-invalid classes) settles one tick after the initial render,
    // so skip Angular's dev-mode checkNoChanges pass here rather than treat that as a bug.
    fixture.detectChanges(false);
  });

  it('should create with an empty, invalid form when no child is given', () => {
    expect(component).toBeTruthy();
    expect(component['form'].valid).toBeFalse();
    expect(component['form'].value.name).toBe('');
  });

  it('closes with the form value and the existing child id on save', () => {
    component.child = { id: 'child-1' } as any;
    component['form'].patchValue({ name: 'Max' });

    component.save();

    expect(activeModal.close).toHaveBeenCalledWith({
      reason: 'save',
      value: jasmine.objectContaining({ name: 'Max', id: 'child-1' }),
    });
  });

  it('closes with a cancel reason on cancel', () => {
    component.cancel();

    expect(activeModal.close).toHaveBeenCalledWith({ reason: 'cancel' });
  });
});
