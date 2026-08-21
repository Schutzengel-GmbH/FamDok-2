import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NumberFilterInput } from './number-filter.component';

describe('NumberFilterInput', () => {
  let component: NumberFilterInput;
  let fixture: ComponentFixture<NumberFilterInput>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NumberFilterInput] }).compileComponents();
    fixture = TestBed.createComponent(NumberFilterInput);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('name', 'Dauer');
    fixture.detectChanges();
  });

  it('resetFilter clears the filter', () => {
    component.changeValue({ target: { value: '5' } } as unknown as Event);

    component.resetFilter();

    expect(component.filter()).toBeUndefined();
  });

  it('changeFilter sets the comparison operator, defaulting the value to 0', () => {
    component.changeFilter({ target: { value: 'gte' } } as unknown as Event);

    expect(component.filter()).toEqual({ filter: 'gte', value: 0 });
  });

  it('changeValue sets a single numeric filter defaulting to "equals"', () => {
    component.changeValue({ target: { value: '42' } } as unknown as Event);

    expect(component.filter()).toEqual({ filter: 'equals', value: 42 });
    expect(component.endValue()).toBe(42);
  });

  it('changeStartValue/changeEndValue build a [start, end] range', () => {
    component.changeStartValue({ target: { value: '5' } } as unknown as Event);
    component.changeEndValue({ target: { value: '15' } } as unknown as Event);

    expect(component.filter()?.value).toEqual([5, 15]);
  });
});
