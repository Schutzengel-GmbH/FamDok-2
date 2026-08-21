import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgSelectComponent } from '@ng-select/ng-select';

import { SelectCaseFormComponent } from './select-case-form.component';

describe('SelectCaseFormComponent', () => {
  let component: SelectCaseFormComponent;
  let fixture: ComponentFixture<SelectCaseFormComponent>;

  const forms = [
    { id: 'form-1', name: 'Aufnahme' },
    { id: 'form-2', name: 'Abschluss' },
  ] as any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectCaseFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SelectCaseFormComponent);
    component = fixture.componentInstance;
  });

  function setup() {
    fixture.componentRef.setInput('forms', forms);
    fixture.detectChanges();
  }

  function ngSelect() {
    return fixture.debugElement.query(By.directive(NgSelectComponent))
      .componentInstance as NgSelectComponent;
  }

  it('passes the forms input through to the ng-select as items with the name label', () => {
    setup();
    expect(ngSelect().items()).toEqual(forms);
    expect(ngSelect().bindLabel()).toBe('name');
  });

  it('has no form selected by default', () => {
    setup();
    expect(component.form()).toBeUndefined();
  });

  it('reflects an externally-set form back through the model', () => {
    setup();
    component.form.set(forms[1]);
    fixture.detectChanges();

    expect(component.form()).toEqual(forms[1]);
  });

  it('updates the model when the ng-select reports a new selection', () => {
    setup();
    const select = ngSelect();
    const option = select.itemsList.findItem(forms[0]);

    select.select(option);
    fixture.detectChanges();

    expect(component.form()).toEqual(forms[0]);
  });
});
