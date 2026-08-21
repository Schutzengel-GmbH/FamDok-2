import { Component, inject, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

@Component({
  selector: 'app-name-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './name-modal.html',
})
export class NameModalComponent implements OnInit {
  @Input() title = 'Name bearbeiten';
  @Input() label = 'Name';
  @Input() name: string | undefined;

  private fb = inject(FormBuilder);

  protected form!: FormGroup;
  protected activeModal = inject(NgbActiveModal);

  ngOnInit() {
    this.form = this.fb.group({
      name: [
        this.name ?? '',
        [Validators.required, Validators.minLength(2)],
      ],
    });
  }

  save() {
    this.activeModal.close({
      reason: 'save',
      value: this.form.value.name as string,
    });
  }

  cancel() {
    this.activeModal.close({ reason: 'cancel' });
  }
}
