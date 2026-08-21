import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimpleTextFilter } from './simple-text-filter.component';

describe('SimpleTextFilter', () => {
  let component: SimpleTextFilter;
  let fixture: ComponentFixture<SimpleTextFilter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SimpleTextFilter] }).compileComponents();
    fixture = TestBed.createComponent(SimpleTextFilter);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('name', 'Text');
    fixture.detectChanges();
  });

  it('changeValue sets the text filter', () => {
    component.changeValue({ target: { value: 'hallo' } } as unknown as Event);

    expect(component.filter()).toBe('hallo');
  });

  it('resetFilter clears to an empty string', () => {
    component.changeValue({ target: { value: 'hallo' } } as unknown as Event);

    component.resetFilter();

    expect(component.filter()).toBe('');
  });
});
