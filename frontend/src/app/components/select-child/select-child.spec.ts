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
});
