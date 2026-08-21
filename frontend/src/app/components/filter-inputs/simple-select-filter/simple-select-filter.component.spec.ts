import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimpleSelectFilter } from './simple-select-filter.component';

describe('SimpleSelectFilter', () => {
  let component: SimpleSelectFilter;
  let fixture: ComponentFixture<SimpleSelectFilter>;
  const options = [{ id: 1, text: 'A' }];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SimpleSelectFilter] }).compileComponents();
    fixture = TestBed.createComponent(SimpleSelectFilter);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('name', 'Auswahl');
    fixture.componentRef.setInput('options', options);
    fixture.detectChanges();
  });

  it('exposes the given options', () => {
    expect(component.options()).toEqual(options as any);
  });

  it('resetFilter clears the filter', () => {
    component.filter.set(options[0]);

    component.resetFilter();

    expect(component.filter()).toBeUndefined();
  });
});
