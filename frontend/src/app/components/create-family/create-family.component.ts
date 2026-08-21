import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule, Location } from '@angular/common';
import { FullCase } from '../../../../../shared/types';
import {
  NgbDateAdapter,
  NgbDateNativeAdapter,
  NgbDateParserFormatter,
  NgbDatepickerModule,
  NgbModal,
} from '@ng-bootstrap/ng-bootstrap';
import { NgbDateDeParserFormatter } from 'src/app/util/NgbDatePickerFormatter';
import { ChildModalComponent } from './modals/child-modal/child-modal';
import { CaregiverModalComponent } from './modals/caregiver-modal/caregiver-modal';
import { ToastService } from 'src/app/services/toast.service';
import { MeService } from 'src/app/services/me.service';
import {
  CaregiverCreateInput,
  CaseCreateInput,
  ChildCreateInput,
  FamilyCreateInput,
} from '../../../../../shared/generated/prisma/models';
import { Familienstand } from '../../../../../shared/generated/prisma/enums';
import { CaseService } from 'src/app/services/case.service';

/**
 * Component for creating a new family and associated case.
 *
 * This component provides a form where users can input family information
 * (name, address, phone, responsible users) and case data (start date).
 *
 */
@Component({
  selector: 'app-create-family',
  templateUrl: './create-family.component.html',
  styleUrls: ['./create-family.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgbDatepickerModule],
  providers: [
    { provide: NgbDateParserFormatter, useClass: NgbDateDeParserFormatter },
    { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter },
  ],
})
export class CreateFamilyComponent {
  private caseService = inject(CaseService);
  private modalService = inject(NgbModal);
  private toastService = inject(ToastService);
  private location = inject(Location);
  private meService = inject(MeService);

  protected readonly Familienstand = Object.keys(Familienstand);

  protected isLoading = false;
  protected errorMessage: string | null = null;

  protected children: ChildCreateInput[] = [];
  protected caregivers: CaregiverCreateInput[] = [];

  // Family fields
  protected name = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2)],
  });
  protected note = new FormControl('', { nonNullable: true });
  protected street = new FormControl('', {
    nonNullable: true,
    validators: Validators.required,
  });
  protected number = new FormControl('', {
    nonNullable: true,
    validators: Validators.required,
  });
  protected plz = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\d{5}$/)],
  });
  protected city = new FormControl('', {
    nonNullable: true,
    validators: Validators.required,
  });
  protected phone = new FormControl('', { nonNullable: true });
  protected additionalPhones = new FormControl('', { nonNullable: true });

  // Case fields
  protected startedAt = new FormControl<Date | null>(null, {
    validators: Validators.required,
  });
  protected migrationBackground = new FormControl<boolean | null>(null);
  protected specificMigrationBackground = new FormControl<string | null>(null);
  protected familienstand = new FormControl<Familienstand | null>(
    Familienstand.unspecified,
  );
  protected partnerInvolved = new FormControl<boolean | null>(null);
  protected bekanntJA = new FormControl<boolean | null>(null);

  protected form = new FormGroup({
    name: this.name,
    note: this.note,
    street: this.street,
    number: this.number,
    plz: this.plz,
    city: this.city,
    phone: this.phone,
    additionalPhones: this.additionalPhones,
    startedAt: this.startedAt,
    migrationBackground: this.migrationBackground,
    specificMigrationBackground: this.specificMigrationBackground,
    familienstand: this.familienstand,
    partnerInvolved: this.partnerInvolved,
    bekanntJA: this.bekanntJA,
  });

  constructor() {
    this.meService.getMe().subscribe((me) => {
      if (!me.organisationId) {
        this.errorMessage =
          'Dieser User ist keiner Organisation zugewiesen, es können keine Familien/Fälle ohne Organiastion erstellt werden. Wenn Sie zu einer Organisation gehören sollten, kontaktieren Sie einen Administrator.';
        this.form.disable();
      }
    });
  }

  familienstandSelected(f: string) {
    return this.familienstand.value === (f as Familienstand);
  }

  familienstandString(f: string) {
    switch (f as Familienstand) {
      case 'ledig':
        return 'Ledig';
      case 'verheiratet':
        return 'Verheiratet';
      case 'geschieden':
        return 'Geschieden';
      case 'unspecified':
        return 'Keine Angabe';
    }
  }

  handleOpenChild(index?: number) {
    const isNew = index === undefined || index === null;
    const lastName = this.name.value;
    const modalRef = this.modalService.open(ChildModalComponent);
    modalRef.componentInstance.child = !isNew
      ? this.children[index]
      : { lastName };
    modalRef.closed.subscribe(
      (
        result:
          { reason: 'cancel' } | { reason: 'save'; value: ChildCreateInput },
      ) =>
        result.reason === 'save'
          ? !isNew
            ? (this.children[index] = result.value)
            : this.children.push(result.value)
          : undefined,
    );
  }

  deleteChild(index: number) {
    this.children.splice(index, 1);
  }

  handleOpenCaregiver(index?: number) {
    const isNew = index === undefined || index === null;
    const lastName = this.name.value;
    const modalRef = this.modalService.open(CaregiverModalComponent);
    modalRef.componentInstance.caregiver = !isNew
      ? this.caregivers[index]
      : lastName
        ? { lastName }
        : undefined;
    modalRef.closed.subscribe(
      (
        result:
          | { reason: 'cancel' }
          | { reason: 'save'; value: CaregiverCreateInput },
      ) =>
        result.reason === 'save'
          ? !isNew
            ? (this.caregivers[index] = result.value)
            : this.caregivers.push(result.value)
          : undefined,
    );
  }

  deleteCaregiver(index: number) {
    this.caregivers.splice(index, 1);
  }

  /**
   * Submits the form to create a family and case.
   * Disables the form during submission and emits appropriate events upon completion.
   */
  protected onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const formValue = this.form.getRawValue();

    // Build family create input
    const familyInput: FamilyCreateInput = {
      name: formValue.name,
      note: formValue.note,
      adress: {
        street: formValue.street,
        number: formValue.number,
        plz: formValue.plz,
        city: formValue.city,
      },
      children: { createMany: { data: this.children } },
      caregiver: { createMany: { data: this.caregivers } },
      phone: formValue.phone || undefined,
      additionalPhones: formValue.additionalPhones
        ? formValue.additionalPhones.replace(/\s/g, '').split(',')
        : [],
    };

    // Build case create input
    const caseInput: Parameters<typeof this.caseService.createFamily>[1] = {
      startedAt: this.startedAt.value!,
      migrationBackground: this.migrationBackground.value,
      specificMigrationBackground: this.specificMigrationBackground.value,
      familienstand: this.familienstand.value,
      partnerInvolved: this.partnerInvolved.value,
      bekanntJA: this.bekanntJA.value,
      city: this.city.value,
      plz: this.plz.value,
    };

    this.caseService.createFamily(familyInput, caseInput).subscribe({
      next: (createdCase: FullCase) => {
        this.isLoading = false;
        this.form.reset();
        this.caregivers = [];
        this.children = [];
        this.location.back();
        this.toastService.show({
          title: 'Gespeichert',
          text: `Deine neuangelegte Familie wurde gespeichert.`,
          severity: 'success',
        });
      },
      error: (err: any) => {
        this.isLoading = false;
        this.errorMessage =
          err.message ??
          'Fehler beim Erstellen der Familie. Bitte versuchen Sie es erneut.';
        console.error('Error creating family:', err);
      },
    });
  }

  /**
   * Resets the form to its initial state.
   */
  protected onReset(): void {
    this.form.reset();
    this.errorMessage = null;
  }

  /**
   * Gets an error message for a form field.
   * @param control The form control to check
   * @param fieldDesc A human-readable name for the field, used in the message
   * @returns Error message string or null
   */
  protected getFieldError(
    control: AbstractControl | null,
    fieldDesc: string,
  ): string | null {
    if (!control || !control.errors || !control.touched) {
      return null;
    }

    if (control.errors['required']) {
      return `${fieldDesc} ist erforderlich.`;
    }
    if (control.errors['minlength']) {
      return `${fieldDesc} muss mindestens ${
        control.errors['minlength'].requiredLength
      } Zeichen lang sein.`;
    }
    if (control.errors['pattern']) {
      return `${fieldDesc} hat ein ungültiges Format.`;
    }

    return 'Dieses Feld ist ungültig.';
  }
}
