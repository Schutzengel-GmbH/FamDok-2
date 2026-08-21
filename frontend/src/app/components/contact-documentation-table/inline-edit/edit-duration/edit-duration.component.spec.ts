import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditDuration } from './edit-duration.component';

describe('EditDuration', () => {
  let component: EditDuration;
  let fixture: ComponentFixture<EditDuration>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EditDuration] }).compileComponents();
    fixture = TestBed.createComponent(EditDuration);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('value', 30);
    fixture.detectChanges();
  });

  it('seeds the working value from the input', () => {
    expect(component['_value']()).toBe(30);
  });

  it('change updates the working value and apply emits it as a number', () => {
    let saved: unknown;
    component.save.subscribe((v) => (saved = v));

    component.change({ target: { value: '45' } } as unknown as Event);
    component.apply();

    expect(saved).toBe(45);
  });

  it('cancel resets the working value and emits nochange', () => {
    component.change({ target: { value: '45' } } as unknown as Event);
    let cancelled = false;
    component.nochange.subscribe(() => (cancelled = true));

    component.cancel();

    expect(component['_value']()).toBe(30);
    expect(cancelled).toBeTrue();
  });
});
