import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditText } from './edit-text.component';

describe('EditText', () => {
  let component: EditText;
  let fixture: ComponentFixture<EditText>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EditText] }).compileComponents();
    fixture = TestBed.createComponent(EditText);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('value', 'hello');
    fixture.detectChanges();
  });

  it('seeds the working value from the input', () => {
    expect(component['_value']()).toBe('hello');
  });

  it('change updates the working value and apply emits it', () => {
    let saved: unknown;
    component.save.subscribe((v) => (saved = v));

    component.change({ target: { value: 'updated' } } as unknown as Event);
    component.apply();

    expect(saved).toBe('updated');
  });

  it('apply emits an empty string when the value is falsy', () => {
    fixture.componentRef.setInput('value', undefined);
    fixture.detectChanges();
    let saved: unknown;
    component.save.subscribe((v) => (saved = v));

    component.apply();

    expect(saved).toBe('');
  });

  it('cancel resets the working value and emits nochange', () => {
    component.change({ target: { value: 'updated' } } as unknown as Event);
    let cancelled = false;
    component.nochange.subscribe(() => (cancelled = true));

    component.cancel();

    expect(component['_value']()).toBe('hello');
    expect(cancelled).toBeTrue();
  });
});
