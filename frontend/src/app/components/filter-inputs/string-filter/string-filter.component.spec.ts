import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StringFilter } from './string-filter.component';

describe('StringFilter', () => {
  let component: StringFilter;
  let fixture: ComponentFixture<StringFilter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StringFilter] }).compileComponents();
    fixture = TestBed.createComponent(StringFilter);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('name', 'Name');
    fixture.detectChanges();
  });

  it('resetFilter clears the filter', () => {
    component.changeValue({ target: { value: 'a' } } as unknown as Event);

    component.resetFilter();

    expect(component.filter()).toBeUndefined();
  });

  it('changeFilter sets the comparison operator, defaulting the value to an empty string', () => {
    component.changeFilter({ target: { value: 'contains' } } as unknown as Event);

    expect(component.filter()).toEqual({ filter: 'contains', value: '' });
  });

  it('changeValue sets the value, defaulting the operator to "equals"', () => {
    component.changeValue({ target: { value: 'Muster' } } as unknown as Event);

    expect(component.filter()).toEqual({ filter: 'equals', value: 'Muster' });
  });

  it('changeValue preserves a previously chosen operator', () => {
    component.changeFilter({ target: { value: 'contains' } } as unknown as Event);

    component.changeValue({ target: { value: 'Muster' } } as unknown as Event);

    expect(component.filter()).toEqual({ filter: 'contains', value: 'Muster' });
  });
});
