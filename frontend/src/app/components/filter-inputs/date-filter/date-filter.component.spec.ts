import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateFilter } from './date-filter.component';

describe('DateFilter', () => {
  let component: DateFilter;
  let fixture: ComponentFixture<DateFilter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DateFilter] }).compileComponents();
    fixture = TestBed.createComponent(DateFilter);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('name', 'Datum');
    fixture.detectChanges();
  });

  it('resetFilter clears the filter', () => {
    component.changeValue(new Date());

    component.resetFilter();

    expect(component.filter()).toBeUndefined();
  });

  it('changeFilter sets the comparison operator, defaulting the value to now', () => {
    component.changeFilter({ target: { value: 'gte' } } as unknown as Event);

    expect(component.filter()?.filter).toBe('gte');
    expect(component.filter()?.value).toBeInstanceOf(Date);
  });

  it('changeValue sets a single-date filter defaulting to "equals"', () => {
    const date = new Date('2026-01-01');

    component.changeValue(date);

    expect(component.filter()).toEqual({ filter: 'equals', value: date });
  });

  it('changeStartValue/changeEndValue build a [start, end] range', () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-02-01');

    component.changeStartValue(start);
    component.changeEndValue(end);

    expect(component.filter()?.value).toEqual([start, end]);
  });
});
