import { Component, Input, OnInit, inject, signal } from '@angular/core';
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
import { gramsToKg, kgToGrams } from 'src/app/util/healthDataUtils';

function atLeastOneMeasurement(
  control: AbstractControl,
): ValidationErrors | null {
  const weight = control.get('weight')?.value;
  const sizeCm = control.get('sizeCm')?.value;
  return weight != null || sizeCm != null
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

  protected weightUnit = signal<'kg' | 'g'>('g');

  private dateAdapter = new NgbDateNativeAdapter();
  protected maxDate = this.dateAdapter.fromModel(new Date())!;

  ngOnInit() {
    this.form = this.fb.group(
      {
        date: [
          this.dataPoint?.date ? new Date(this.dataPoint.date) : new Date(),
          [Validators.required],
        ],
        weight: [
          this.dataPoint?.weightKg != null
            ? this.weightUnit() === 'g'
              ? kgToGrams(this.dataPoint.weightKg)
              : this.dataPoint.weightKg
            : null,
        ],
        sizeCm: [this.dataPoint?.sizeCm ?? null],
      },
      { validators: atLeastOneMeasurement },
    );
  }

  save() {
    const value = this.form.value as {
      date: Date;
      weight: number | null;
      sizeCm: number | null;
    };
    const dataPoint: PrismaJson.HealthDataPointChild = { date: value.date };
    if (value.weight != null)
      dataPoint.weightKg =
        this.weightUnit() === 'g' ? gramsToKg(value.weight) : value.weight;
    if (value.sizeCm != null) dataPoint.sizeCm = value.sizeCm;

    this.activeModal.close({ reason: 'save', value: dataPoint });
  }

  changeUnit(e: Event) {
    const unit = (e.target as HTMLSelectElement).value as 'g' | 'kg';
    this.weightUnit.set(unit);
  }

  cancel() {
    this.activeModal.close({ reason: 'cancel' });
  }
}
