import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectChildComponent } from './select-child';

describe('SelectChild', () => {
  let component: SelectChildComponent;
  let fixture: ComponentFixture<SelectChildComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectChildComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectChildComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with no case selected', () => {
    expect(component).toBeTruthy();
    expect(component.case()).toBeUndefined();
  });

  it('updates the selected child on change', () => {
    const child = { id: 'child-1', name: 'Max' } as any;

    component.change(child);

    expect(component.child()).toBe(child);
  });
});
