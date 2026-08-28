import { Component, inject, OnInit, input, Input } from '@angular/core';
import {
  NgbActiveModal,
  NgbDateAdapter,
  NgbDateNativeAdapter,
  NgbDateParserFormatter,
  NgbDatepickerModule,
} from '@ng-bootstrap/ng-bootstrap';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgbDateDeParserFormatter } from 'src/app/util/NgbDatePickerFormatter';
import { ChildCreateInput } from '../../../../../../../shared/generated/prisma/models';
import { Gender } from '../../../../../../../shared/generated/prisma/enums';

@Component({
  selector: 'app-child-modal',
  standalone: true,
  imports: [ReactiveFormsModule, NgbDatepickerModule],
  templateUrl: './child-modal.html',
  styleUrl: './child-modal.scss',
  providers: [
    { provide: NgbDateParserFormatter, useClass: NgbDateDeParserFormatter },
    { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter },
  ],
})
export class ChildModalComponent implements OnInit {
  @Input() child: ChildCreateInput | undefined;

  private fb = inject(FormBuilder);

  protected form!: FormGroup;
  protected activeModal = inject(NgbActiveModal);

  private dateAdapter = new NgbDateNativeAdapter();
  protected minDate = this.dateAdapter.fromModel(new Date('1900-01-01'))!;
  protected maxDate = this.dateAdapter.fromModel(new Date())!;

  constructor() {}

  ngOnInit() {
    this.form = this.fb.group({
      name: [
        this.child?.name ?? '',
        [Validators.required, Validators.minLength(2)],
      ],
      lastName: [this.child?.lastName ?? ''],
      gender: [this.child?.gender ?? ('unspecified' as Gender)],
      dateOfBirth: [
        this.child?.dateOfBirth ? new Date(this.child.dateOfBirth) : '',
        [Validators.required],
      ],
    });
  }

  save() {
    this.activeModal.close({
      reason: 'save',
      value: {
        ...(this.form.value as ChildCreateInput),
        id: this.child?.id,
      },
    });
  }

  cancel() {
    this.activeModal.close({ reason: 'cancel' });
  }
}
