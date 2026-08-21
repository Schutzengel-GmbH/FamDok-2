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
import { CaregiverCreateInput } from '../../../../../../../shared/generated/prisma/models';
import {
  Gender,
  Relation,
} from '../../../../../../../shared/generated/prisma/enums';
import { Caregiver } from '../../../../../../../shared/generated/prisma/client';

@Component({
  selector: 'app-caregiver-modal',
  standalone: true,
  imports: [ReactiveFormsModule, NgbDatepickerModule],
  templateUrl: './caregiver-modal.html',
  styleUrl: './caregiver-modal.scss',
  providers: [
    { provide: NgbDateParserFormatter, useClass: NgbDateDeParserFormatter },
    { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter },
  ],
})
export class CaregiverModalComponent implements OnInit {
  @Input() caregiver!: Caregiver | undefined;

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
        this.caregiver?.name ?? '',
        [Validators.required, Validators.minLength(2)],
      ],
      lastName: [this.caregiver?.lastName ?? ''],
      relation: [
        this.caregiver?.relation ?? ('' as Relation),
        Validators.required,
      ],
      gender: [this.caregiver?.gender ?? ('unspecified' as Gender)],
      dateOfBirth: [new Date(this.caregiver?.dateOfBirth!) ?? ''],
    });
  }

  save() {
    this.activeModal.close({
      reason: 'save',
      value: this.form.value as CaregiverCreateInput,
    });
  }

  cancel() {
    this.activeModal.close({ reason: 'cancel' });
  }
}
