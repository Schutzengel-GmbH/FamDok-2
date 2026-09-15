import { Component, Input, OnInit, inject } from '@angular/core';
import {
  NgbActiveModal,
  NgbDateAdapter,
  NgbDateNativeAdapter,
  NgbDateParserFormatter,
  NgbDatepickerModule,
} from '@ng-bootstrap/ng-bootstrap';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NgbDateDeParserFormatter } from 'src/app/util/NgbDatePickerFormatter';

function atLeastOneMeasurement(control: AbstractControl): ValidationErrors | null {
  const weightKg = control.get('weightKg')?.value;
  const sizeCm = control.get('sizeCm')?.value;
  return weightKg != null || sizeCm != null
    ? null
    : { atLeastOneMeasurement: true };
}

@Component({
  selector: 'app-health-data-modal',
  standalone: true,
  imports: [ReactiveFormsModule, NgbDatepickerModule],
  templateUrl: './health-data-modal.component.html',
  providers: [
    { provide: NgbDateParserFormatter, useClass: NgbDateDeParserFormatter },
    { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter },
  ],
})
export class HealthDataModalComponent implements OnInit {
  @Input() dataPoint: PrismaJson.HealthDataPointChild | undefined;

  private fb = inject(FormBuilder);

  protected form!: FormGroup;
  protected activeModal = inject(NgbActiveModal);

  private dateAdapter = new NgbDateNativeAdapter();
  protected maxDate = this.dateAdapter.fromModel(new Date())!;

  ngOnInit() {
    this.form = this.fb.group(
      {
        date: [
          this.dataPoint?.date ? new Date(this.dataPoint.date) : new Date(),
          [Validators.required],
        ],
        weightKg: [this.dataPoint?.weightKg ?? null],
        sizeCm: [this.dataPoint?.sizeCm ?? null],
      },
      { validators: atLeastOneMeasurement },
    );
  }

  save() {
    const value = this.form.value as {
      date: Date;
      weightKg: number | null;
      sizeCm: number | null;
    };
    const dataPoint: PrismaJson.HealthDataPointChild = { date: value.date };
    if (value.weightKg != null) dataPoint.weightKg = value.weightKg;
    if (value.sizeCm != null) dataPoint.sizeCm = value.sizeCm;

    this.activeModal.close({ reason: 'save', value: dataPoint });
  }

  cancel() {
    this.activeModal.close({ reason: 'cancel' });
  }
}
