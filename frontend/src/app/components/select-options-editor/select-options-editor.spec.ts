import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';

import { SelectOptionsEditorComponent } from './select-options-editor';

describe('SelectOptionsEditorComponent', () => {
  let component: SelectOptionsEditorComponent;
  let fixture: ComponentFixture<SelectOptionsEditorComponent>;
  let fb: FormBuilder;

  function optionGroup(id: number, text: string, isOpen = false) {
    return fb.group({ id: [id], text: [text], isOpen: [isOpen] });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectOptionsEditorComponent],
    }).compileComponents();
    fb = TestBed.inject(FormBuilder);
    fixture = TestBed.createComponent(SelectOptionsEditorComponent);
    component = fixture.componentInstance;
    component.optionsArray = fb.array<FormGroup>([
      optionGroup(0, 'A'),
      optionGroup(1, 'B'),
    ]) as FormArray<FormGroup>;
    fixture.detectChanges();
  });

  it('addOption appends a new option with the next sequential id', () => {
    component.addOption();

    expect(component.optionsArray.length).toBe(3);
    expect(component.optionsArray.at(2).get('id')!.value).toBe(2);
  });

  it('addOption starts from 0 on an empty array', () => {
    component.optionsArray = fb.array<FormGroup>([]) as FormArray<FormGroup>;

    component.addOption();

    expect(component.optionsArray.at(0).get('id')!.value).toBe(0);
  });

  it('removeOption removes the option at the given index', () => {
    component.removeOption(0);

    expect(component.optionsArray.length).toBe(1);
    expect(component.optionsArray.at(0).get('text')!.value).toBe('B');
  });

  it('setOpenOption marks exactly one option as open, clearing the rest', () => {
    component.setOpenOption(1);

    expect(component.optionsArray.at(0).get('isOpen')!.value).toBeFalse();
    expect(component.optionsArray.at(1).get('isOpen')!.value).toBeTrue();
    expect(component.hasOpenOption()).toBeTrue();
  });

  it('clearOpenOption unmarks every option', () => {
    component.setOpenOption(1);

    component.clearOpenOption();

    expect(component.hasOpenOption()).toBeFalse();
  });
});
