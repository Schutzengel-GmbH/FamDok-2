import { Component, inject, input, Input, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  NgbDateAdapter,
  NgbDateNativeAdapter,
  NgbDateParserFormatter,
  NgbModal,
} from '@ng-bootstrap/ng-bootstrap';
import { Location } from '@angular/common';
import { FamilyService } from 'src/app/services/family.service';
import { ToastService } from 'src/app/services/toast.service';
import { FullFamily } from '../../../../../shared/types';
import { CaregiverModalComponent } from '../create-family/modals/caregiver-modal/caregiver-modal';
import { ChildModalComponent } from '../create-family/modals/child-modal/child-modal';
import { NgbDateDeParserFormatter } from 'src/app/util/NgbDatePickerFormatter';
import {
  CaregiverCreateInput,
  CaregiverUpdateInput,
  ChildCreateInput,
  ChildUpdateInput,
  FamilyUpdateInput,
} from '../../../../../shared/generated/prisma/models';
import { Familienstand } from '../../../../../shared/generated/prisma/enums';

@Component({
  selector: 'app-edit-family',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './edit-family.html',
  styleUrl: './edit-family.scss',
  providers: [
    { provide: NgbDateParserFormatter, useClass: NgbDateDeParserFormatter },
    { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter },
  ],
})
export class EditFamilyComponent implements OnInit {
  @Input() familyId!: string;
  readOnly = input(false);

  private familyService = inject(FamilyService);
  private modalService = inject(NgbModal);
  private toast = inject(ToastService);
  private location = inject(Location);

  protected family!: FullFamily;
  protected caregivers!: CaregiverUpdateInput[];
  protected children!: ChildUpdateInput[];
  protected isSaving = false;
  protected isLoading = true;
  protected listsDirty = false;

  // Family fields
  protected name = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2)],
  });
  protected note = new FormControl<string | null>(null);
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
  protected phone = new FormControl<string | null>(null);
  protected additionalPhones = new FormControl('', { nonNullable: true });

  // Case fields
  protected migrationBackground = new FormControl<boolean | null>(null);
  protected specificMigrationBackground = new FormControl<string | null>(null);
  protected familienstand = new FormControl<Familienstand | null>(null);
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
    migrationBackground: this.migrationBackground,
    specificMigrationBackground: this.specificMigrationBackground,
    familienstand: this.familienstand,
    partnerInvolved: this.partnerInvolved,
    bekanntJA: this.bekanntJA,
  });

  ngOnInit() {
    this.familyService.getFamily(this.familyId).subscribe({
      next: (f) => {
        this.init(f);
      },
      error: (err) => {
        console.error(err);
        this.toast.show({
          title: 'Fehler',
          text: `Beim Laden der Familie ist ein Fehler aufgetreten: ${err.message ? err.message : err}`,
          severity: 'danger',
        });
      },
    });
  }

  init(f: FullFamily) {
    this.family = f;

    this.caregivers = structuredClone(f.caregiver);
    this.children = structuredClone(f.children);

    this.children.map((c) => delete (c as { familyId: any }).familyId);
    this.caregivers.map((c) => delete (c as { familyId: any }).familyId);

    const currentCase = f.case;

    this.name.setValue(f.name);
    this.note.setValue(f.note);
    this.street.setValue(f.adress?.street ?? '');
    this.number.setValue(f.adress?.number ?? '');
    this.plz.setValue(f.adress?.plz ?? '');
    this.city.setValue(f.adress?.city ?? '');
    this.phone.setValue(f.phone);
    this.additionalPhones.setValue(
      f.additionalPhones.reduce((prev, n) => (prev ? prev + ', ' + n : n), ''),
    );
    this.migrationBackground.setValue(currentCase?.migrationBackground ?? null);
    this.specificMigrationBackground.setValue(
      currentCase?.specificMigrationBackground ?? null,
    );
    this.familienstand.setValue(currentCase?.familienstand ?? null);
    this.partnerInvolved.setValue(currentCase?.partnerInvolved ?? null);
    this.bekanntJA.setValue(currentCase?.bekanntJA ?? null);

    this.form.markAsPristine();
    this.form.markAsUntouched();
    if (this.readOnly()) this.form.disable();

    this.listsDirty = false;
    this.isLoading = false;
  }

  protected readonly Familienstand = Object.keys(Familienstand);

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

  protected get isDirty(): boolean {
    return this.form?.dirty || this.listsDirty;
  }

  handleOpenChild(index?: number) {
    if (this.readOnly()) return;
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
      ) => {
        if (result.reason !== 'save') return;
        !isNew
          ? (this.children[index] = result.value)
          : this.children.push(result.value);
        this.listsDirty = true;
      },
    );
  }

  deleteChild(index: number) {
    if (this.readOnly()) return;
    this.children.splice(index, 1);
    this.listsDirty = true;
  }

  handleOpenCaregiver(index?: number) {
    if (this.readOnly()) return;
    const isNew = index === undefined || index === null;
    const lastName = this.name.value;
    const modalRef = this.modalService.open(CaregiverModalComponent);
    modalRef.componentInstance.caregiver = !isNew
      ? this.caregivers[index]
      : { lastName };
    modalRef.closed.subscribe(
      (
        result:
          | { reason: 'cancel' }
          | { reason: 'save'; value: CaregiverCreateInput },
      ) => {
        if (result.reason !== 'save') return;
        !isNew
          ? (this.caregivers[index] = result.value)
          : this.caregivers.push(result.value);
        this.listsDirty = true;
      },
    );
  }

  deleteCaregiver(index: number) {
    if (this.readOnly()) return;
    this.caregivers.splice(index, 1);
    this.listsDirty = true;
  }

  onSubmit() {
    if (this.readOnly()) return;
    this.isSaving = true;
    this.familyService
      .updateFamily(this.family.id, this.makeUpdateInput())
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.toast.show({
            title: 'Gespeichert',
            text: `Änderungen an ${this.name.value} wurden erfolgreich gespeichert.`,
            severity: 'success',
          });
          this.location.back();
        },
        error: () => {
          this.isSaving = false;
          this.toast.show({
            title: 'Fehler',
            text: 'Beim Speichern der Änderungen ist ein Fehler aufgetreten.',
            severity: 'danger',
          });
        },
      });
  }

  onReset() {
    this.init(this.family);
  }

  makeUpdateInput(): FamilyUpdateInput {
    return {
      name: this.valueIfChanged(this.name, this.family.name),
      note: this.valueIfChanged(this.note, this.family.note),
      phone: this.valueIfChanged(this.phone, this.family.phone),
      additionalPhones: this.additionalPhones.value
        .replace(/\s/g, '')
        .split(','),
      caregiver: {
        deleteMany: { id: { in: this.family.caregiver.map((c) => c.id) } },
        createMany: {
          data: this.caregivers
            .filter((c) => this.caregivers.some((tc) => tc.id === c.id))
            .map((c) => c as CaregiverCreateInput),
        },
      },
      children: {
        deleteMany: { id: { in: this.family.children.map((c) => c.id) } },
        createMany: {
          data: this.children
            .filter((c) => this.children.some((tc) => tc.id === c.id))
            .map((c) => c as ChildCreateInput),
        },
      },
      adress: {
        street: this.street.value,
        number: this.number.value,
        plz: this.plz.value,
        city: this.city.value,
      },
      case: {
        update: {
          city: this.valueIfChanged(this.city, this.family.adress?.city),
          plz: this.valueIfChanged(this.plz, this.family.adress?.plz),
          migrationBackground: this.valueIfChanged(
            this.migrationBackground,
            this.family.case?.migrationBackground,
          ),
          specificMigrationBackground: this.valueIfChanged(
            this.specificMigrationBackground,
            this.family.case?.specificMigrationBackground,
          ),
          familienstand: this.valueIfChanged(
            this.familienstand,
            this.family.case?.familienstand,
          ),
          partnerInvolved: this.valueIfChanged(
            this.partnerInvolved,
            this.family.case?.partnerInvolved,
          ),
          bekanntJA: this.valueIfChanged(
            this.bekanntJA,
            this.family.case?.bekanntJA,
          ),
        },
      },
    };
  }

  private valueIfChanged<T>(
    control: FormControl<T>,
    original: T,
  ): T | undefined {
    return control.value === original ? undefined : control.value;
  }
}
