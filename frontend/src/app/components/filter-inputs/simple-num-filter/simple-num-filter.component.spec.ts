import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimpleNumberFilter } from './simple-num-filter.component';

describe('SimpleNumberFilter', () => {
  let component: SimpleNumberFilter;
  let fixture: ComponentFixture<SimpleNumberFilter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SimpleNumberFilter] }).compileComponents();
    fixture = TestBed.createComponent(SimpleNumberFilter);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('name', 'Anzahl');
    fixture.detectChanges();
  });

  it('changeValue sets the numeric filter', () => {
    component.changeValue({ target: { value: '7' } } as unknown as Event);

    expect(component.filter()).toBe(7);
  });

  it('resetFilter clears the filter', () => {
    component.changeValue({ target: { value: '7' } } as unknown as Event);

    component.resetFilter();

    expect(component.filter()).toBeUndefined();
  });
});
