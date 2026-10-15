import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { UserService } from 'src/app/services/user.service';
import {
  AdminUser,
  FullOrganisation,
  FullSubOrganisation,
  KcStatus,
} from '../../../../../../shared/types';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ToastService } from 'src/app/services/toast.service';
import { environment } from 'src/environments/environment';
import { MultiSelect } from 'src/app/components/multi-select/multi-select.component';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { userPipe } from 'src/app/util/tableTransformPipes';
import { watchScope } from '../user-form-utils';
import { TempPasswordComponent } from '../temp-password/temp-password.component';

@Component({
  selector: 'app-user-item',
  standalone: true,
  imports: [ReactiveFormsModule, MultiSelect, TempPasswordComponent],
  templateUrl: './user-item.component.html',
})
export class UserItemComponent implements OnInit {
  @Input() user!: AdminUser;
  @Input() orgs!: FullOrganisation[];

  private userService = inject(UserService);
  private toastService = inject(ToastService);
  private dialogService = inject(ConfirmDialogService);

  private fb = inject(FormBuilder);
  form!: FormGroup;

  jobTitles = environment.jobTitles;

  /** Keycloak account state, undefined if it couldn't be loaded */
  kcStatus = signal<KcStatus | undefined>(undefined);
  /** shown once after issuing a temporary password */
  tempPassword = signal<string | undefined>(undefined);

  ngOnInit(): void {
    this.kcStatus.set(this.user?.kcStatus);

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

    watchScope(this.form, () => this.orgs);
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
      style: 'danger',
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

  hasPendingAction(action: string) {
    return !!this.kcStatus()?.pendingActions.includes(action);
  }

  resendInvite() {
    this.userService.resendInvite(this.user.id).subscribe(() => {
      this.toastService.show({
        title: 'Einladung gesendet',
        text: `Eine neue Einladung wurde an ${this.user.email} gesendet.`,
        severity: 'success',
      });
      this.kcStatus.update(
        (s) =>
          s && {
            ...s,
            pendingActions: [
              ...new Set([...s.pendingActions, 'UPDATE_PASSWORD', 'VERIFY_EMAIL']),
            ],
          },
      );
    });
  }

  issueTempPassword() {
    this.dialogService.open({
      title: 'Temporäres Passwort vergeben?',
      text: `Das bisherige Passwort von ${userPipe.transform(this.user)} wird ersetzt. Das neue Passwort muss beim nächsten Login geändert werden.`,
      style: 'warning',
      confirmAction: () =>
        this.userService
          .issueTempPassword(this.user.id)
          .subscribe(({ tempPassword }) => {
            this.tempPassword.set(tempPassword);
            this.kcStatus.update(
              (s) =>
                s && {
                  ...s,
                  emailVerified: true,
                  pendingActions: ['UPDATE_PASSWORD'],
                },
            );
          }),
    });
  }

  toggleEnabled() {
    const enable = this.kcStatus()?.enabled === false;
    const apply = () =>
      this.userService.setEnabled(this.user.id, enable).subscribe((u) => {
        this.kcStatus.set(u.kcStatus);
        this.toastService.show({
          title: enable ? 'Benutzer entsperrt' : 'Benutzer gesperrt',
          text: enable
            ? `${userPipe.transform(this.user)} kann sich wieder anmelden.`
            : `${userPipe.transform(this.user)} kann sich nicht mehr anmelden.`,
          severity: 'success',
        });
      });

    if (enable) {
      apply();
      return;
    }
    this.dialogService.open({
      title: `Benutzer ${userPipe.transform(this.user)} sperren?`,
      text: 'Gesperrte Benutzer können sich nicht mehr anmelden. Ihre Daten bleiben erhalten.',
      style: 'warning',
      confirmAction: apply,
    });
  }
}
