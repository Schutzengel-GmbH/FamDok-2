import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditDate } from './edit-date.component';

describe('EditDate', () => {
  let component: EditDate;
  let fixture: ComponentFixture<EditDate>;
  const initial = new Date('2026-01-01');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EditDate] }).compileComponents();
    fixture = TestBed.createComponent(EditDate);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('value', initial);
    fixture.detectChanges();
  });

  it('seeds the working value from the input', () => {
    expect(component['_value']()).toBe(initial);
  });

  it('apply emits the changed value', () => {
    let saved: unknown;
    component.save.subscribe((v) => (saved = v));
    const next = new Date('2026-02-01');

    component.change(next);
    component.apply();

    expect(saved).toBe(next);
  });

  it('apply does not emit when there is no value', () => {
    fixture.componentRef.setInput('value', undefined);
    fixture.detectChanges();
    let saved: unknown;
    component.save.subscribe((v) => (saved = v));

    component.apply();

    expect(saved).toBeUndefined();
  });

  it('cancel resets the working value and emits nochange', () => {
    component.change(new Date('2026-02-01'));
    let cancelled = false;
    component.nochange.subscribe(() => (cancelled = true));

    component.cancel();

    expect(component['_value']()).toBe(initial);
    expect(cancelled).toBeTrue();
  });
});
