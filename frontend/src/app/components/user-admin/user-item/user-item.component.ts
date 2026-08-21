import { Component, inject, Input, OnInit } from '@angular/core';
import { UserService } from 'src/app/services/user.service';
import {
  FullOrganisation,
  FullSubOrganisation,
  FullUser,
} from '../../../../../../shared/types';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ToastService } from 'src/app/services/toast.service';
import { environment } from 'src/environments/environment';
import { MultiSelect } from 'src/app/components/multi-select/multi-select.component';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { userPipe } from 'src/app/util/tableTransformPipes';
import { Role } from '../../../../../../shared/generated/prisma/enums';

const ROLES_REQUIRING_ORG: Role[] = [
  Role.OrgController,
  Role.OrgCoordinator,
  Role.SubOrgCoordinator,
];

function nonEmptyArray(control: AbstractControl): ValidationErrors | null {
  return Array.isArray(control.value) && control.value.length > 0
    ? null
    : { required: true };
}

@Component({
  selector: 'app-user-item',
  standalone: true,
  imports: [ReactiveFormsModule, MultiSelect],
  templateUrl: './user-item.component.html',
})
export class UserItemComponent implements OnInit {
  @Input() user!: FullUser;
  @Input() orgs!: FullOrganisation[];

  private userService = inject(UserService);
  private toastService = inject(ToastService);
  private dialogService = inject(ConfirmDialogService);

  private fb = inject(FormBuilder);
  form!: FormGroup;

  jobTitles = environment.jobTitles;

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName: this.user?.firstName,
      lastName: this.user?.lastName,
      role: this.user?.role,
      organisationId: this.user?.organisationId,
      jobTitle: this.user?.jobTitle,
      subOrganisationIds: [
        this.user?.subOrganisations?.map((subOrg) => subOrg.id) ?? [],
      ],
    });

    this.form.get('organisationId')?.valueChanges.subscribe((orgId) => {
      const validIds = new Set(
        this.availableSubOrgs(orgId).map((subOrg) => subOrg.id),
      );
      const selected: string[] =
        this.form.get('subOrganisationIds')?.value ?? [];
      const filtered = selected.filter((id) => validIds.has(id));
      if (filtered.length !== selected.length) {
        this.form.get('subOrganisationIds')?.setValue(filtered);
      }
    });

    this.form.get('role')?.valueChanges.subscribe(() => this.updateScopeValidators());
    this.updateScopeValidators();
  }

  /** OrgController/OrgCoordinator need an organisation, SubOrgCoordinator additionally needs
   * at least one suborganisation - misconfiguring these roles would silently break their
   * org/suborg-scoped data access, so enforce it here rather than only server-side. */
  private updateScopeValidators() {
    const role = this.form.get('role')?.value;
    const orgControl = this.form.get('organisationId');
    const subOrgControl = this.form.get('subOrganisationIds');

    orgControl?.setValidators(
      ROLES_REQUIRING_ORG.includes(role) ? [Validators.required] : [],
    );
    orgControl?.updateValueAndValidity({ emitEvent: false });

    subOrgControl?.setValidators(
      role === Role.SubOrgCoordinator ? [nonEmptyArray] : [],
    );
    subOrgControl?.updateValueAndValidity({ emitEvent: false });
  }

  availableSubOrgs(orgId?: string): FullSubOrganisation[] {
    const id = orgId ?? this.form?.get('organisationId')?.value;
    return this.orgs?.find((org) => org.id === id)?.subOrganisations ?? [];
  }

  selectedSubOrgs(): FullSubOrganisation[] {
    const ids: string[] = this.form.get('subOrganisationIds')?.value ?? [];
    return this.availableSubOrgs().filter((subOrg) => ids.includes(subOrg.id));
  }

  subOrgCompareFn = (a: FullSubOrganisation, b: FullSubOrganisation) =>
    a.id === b.id;

  onSubOrgsChange(selected: FullSubOrganisation[]) {
    const control = this.form.get('subOrganisationIds');
    control?.setValue(selected.map((subOrg) => subOrg.id));
    control?.markAsDirty();
  }

  save() {
    if (this.form.pristine) return;

    const subOrganisationIds: string[] =
      this.form.get('subOrganisationIds')?.value ?? [];

    this.userService
      .updateUser(this.user.id, {
        firstName: this.form.get('firstName')?.value,
        lastName: this.form.get('lastName')?.value,
        role: this.form.get('role')?.value,
        jobTitle: this.form.get('jobTitle')?.value,
        organisation: this.form.get('organisationId')?.value
          ? {
              connect: { id: this.form.get('organisationId')!.value },
            }
          : { disconnect: true },
        subOrganisations: {
          set: subOrganisationIds.map((id) => ({ id })),
        },
      })
      .subscribe((u) => {
        this.toastService.show({
          title: 'Update erfolgreich',
          text: 'Der Benutzer wurde erfolgreich geupdatet.',
          severity: 'success',
        });
        this.form.markAsPristine();
      });
  }

  delete() {
    this.dialogService.open({
      title: `Benutzer ${userPipe.transform(this.user)} löschen?`,
      text: `Soll der Benutzer ${userPipe.transform(this.user)} wirklich gelöscht werden? Dies kann nicht rückgängig gemacht werden.`,
      confirmAction: () =>
        this.userService.deleteUser(this.user.id).subscribe((u) =>
          this.toastService.show({
            title: 'Benutzer gelöscht',
            text: `Der Benutzer ${userPipe.transform(this.user)} wurde erfolgreich gelöscht.`,
            severity: 'success',
          }),
        ),
    });
  }
}
