import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditTopic } from './edit-topic.component';

describe('EditTopic', () => {
  let component: EditTopic;
  let fixture: ComponentFixture<EditTopic>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EditTopic] }).compileComponents();
    fixture = TestBed.createComponent(EditTopic);
    component = fixture.componentInstance;
  });

  function setup(prop: 'artDerBetreuung' | 'beratungsThemenAllgemein', value: any) {
    fixture.componentRef.setInput('prop', prop);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
  }

  it('wraps a single artDerBetreuung value into an array for the multi-select', () => {
    setup('artDerBetreuung', { id: 0, text: 'Hausbesuch' });

    expect(component['_value']()).toEqual([{ id: 0, text: 'Hausbesuch' }]);
  });

  it('passes an array value through unchanged for a multi-value prop', () => {
    const value = [{ id: 0, text: 'A' }, { id: 1, text: 'B' }];
    setup('beratungsThemenAllgemein', value);

    expect(component['_value']()).toEqual(value as any);
  });

  it('apply emits the single selected option for artDerBetreuung', () => {
    setup('artDerBetreuung', { id: 0, text: 'Hausbesuch' });
    let saved: unknown;
    component.save.subscribe((v) => (saved = v));

    component.change([{ id: 1, text: 'Telefonat' }]);
    component.apply();

    expect(saved).toEqual({ id: 1, text: 'Telefonat' });
  });

  it('apply emits null for artDerBetreuung when nothing is selected', () => {
    setup('artDerBetreuung', undefined);
    let saved: unknown;
    component.save.subscribe((v) => (saved = v));

    component.change([]);
    component.apply();

    expect(saved).toBeNull();
  });

  it('apply emits the full array for a multi-value prop', () => {
    setup('beratungsThemenAllgemein', []);
    const value = [{ id: 0, text: 'A' }];
    let saved: unknown;
    component.save.subscribe((v) => (saved = v));

    component.change(value);
    component.apply();

    expect(saved).toEqual(value as any);
  });

  it('cancel emits nochange', () => {
    setup('artDerBetreuung', undefined);
    let cancelled = false;
    component.nochange.subscribe(() => (cancelled = true));

    component.cancel();

    expect(cancelled).toBeTrue();
  });
});
