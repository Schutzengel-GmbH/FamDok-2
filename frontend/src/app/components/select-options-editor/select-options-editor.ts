import { Component, inject, Input } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

@Component({
  selector: 'app-select-options-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './select-options-editor.html',
  styleUrl: './select-options-editor.scss',
})
export class SelectOptionsEditorComponent {
  @Input({ required: true }) optionsArray!: FormArray<FormGroup>;

  private fb = inject(FormBuilder);

  protected readonly openOptionGroupName =
    'openOption-' + Math.random().toString(36).slice(2);

  addOption() {
    const nextId = this.optionsArray.controls.reduce(
      (max, control) => Math.max(max, (control.get('id')!.value as number) + 1),
      0,
    );

    this.optionsArray.push(
      this.fb.group({
        id: [nextId],
        text: ['', Validators.required],
        isOpen: [false],
      }),
    );
  }

  removeOption(index: number) {
    this.optionsArray.removeAt(index);
  }

  /**
   * Only one option per question may be flagged as the free-text ("Sonstiges")
   * option, since answer-time only handles a single open option per question.
   */
  setOpenOption(index: number) {
    this.optionsArray.controls.forEach((control, i) => {
      control.get('isOpen')!.setValue(i === index, { emitEvent: false });
    });
  }

  clearOpenOption() {
    this.optionsArray.controls.forEach((control) => {
      control.get('isOpen')!.setValue(false, { emitEvent: false });
    });
  }

  hasOpenOption(): boolean {
    return this.optionsArray.controls.some(
      (control) => control.get('isOpen')!.value === true,
    );
  }
}
