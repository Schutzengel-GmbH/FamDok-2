import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { NameModalComponent } from './name-modal';

describe('NameModalComponent', () => {
  let component: NameModalComponent;
  let fixture: ComponentFixture<NameModalComponent>;
  let activeModal: jasmine.SpyObj<NgbActiveModal>;

  beforeEach(async () => {
    activeModal = jasmine.createSpyObj('NgbActiveModal', ['close', 'dismiss']);

    await TestBed.configureTestingModule({
      imports: [NameModalComponent],
      providers: [{ provide: NgbActiveModal, useValue: activeModal }],
    }).compileComponents();

    fixture = TestBed.createComponent(NameModalComponent);
    component = fixture.componentInstance;
  });

  it('defaults to the "Name bearbeiten" title/label and an empty, invalid form', () => {
    fixture.detectChanges(false);

    expect(component.title).toBe('Name bearbeiten');
    expect(component.label).toBe('Name');
    expect(component['form'].value.name).toBe('');
    expect(component['form'].valid).toBeFalse();
  });

  it('pre-fills the form when an existing name is given', () => {
    component.name = 'Kreisjugendamt';
    fixture.detectChanges(false);

    expect(component['form'].value.name).toBe('Kreisjugendamt');
    expect(component['form'].valid).toBeTrue();
  });

  it('is invalid when the name is shorter than 2 characters', () => {
    fixture.detectChanges(false);

    component['form'].patchValue({ name: 'A' });
    expect(component['form'].invalid).toBeTrue();
    expect(component['form'].get('name')?.hasError('minlength')).toBeTrue();
  });

  it('is invalid when the name is empty', () => {
    fixture.detectChanges(false);

    component['form'].patchValue({ name: '' });
    expect(component['form'].get('name')?.hasError('required')).toBeTrue();
  });

  it('is valid with a 2+ character name', () => {
    fixture.detectChanges(false);

    component['form'].patchValue({ name: 'Ok' });
    expect(component['form'].valid).toBeTrue();
  });

  it('closes with the form value on save', () => {
    fixture.detectChanges(false);
    component['form'].patchValue({ name: 'Neue Organisation' });

    component.save();

    expect(activeModal.close).toHaveBeenCalledWith({
      reason: 'save',
      value: 'Neue Organisation',
    });
  });

  it('closes with a cancel reason on cancel', () => {
    fixture.detectChanges(false);

    component.cancel();

    expect(activeModal.close).toHaveBeenCalledWith({ reason: 'cancel' });
  });

  it('disables the save button while the form is invalid', () => {
    fixture.detectChanges(false);

    const saveBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.modal-footer button',
    );
    expect(saveBtn.disabled).toBeTrue();

    component['form'].patchValue({ name: 'Valider Name' });
    fixture.detectChanges(false);
    expect(saveBtn.disabled).toBeFalse();
  });
});
