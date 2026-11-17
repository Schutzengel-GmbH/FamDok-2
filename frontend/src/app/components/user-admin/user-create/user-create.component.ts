import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from 'src/app/services/user.service';
import { ToastService } from 'src/app/services/toast.service';
import { environment } from 'src/environments/environment';
import { MultiSelect } from 'src/app/components/multi-select/multi-select.component';
import {
  AdminUser,
  FullOrganisation,
  FullSubOrganisation,
} from '../../../../../../shared/types';
import { Role } from '../../../../../../shared/generated/prisma/enums';
import { watchScope } from '../user-form-utils';
import { TempPasswordComponent } from '../temp-password/temp-password.component';

@Component({
  selector: 'app-user-create',
  standalone: true,
  imports: [ReactiveFormsModule, MultiSelect, TempPasswordComponent],
  templateUrl: './user-create.component.html',
  styleUrl: './user-create.component.scss',
})
export class UserCreateComponent {
  orgs = input<FullOrganisation[]>([]);
  /** admins may pick any role and organisation, others create users in their own organisation */
  forAdmin = input(false);
  /** organisation new users are assigned to when not `forAdmin` */
  ownOrganisationId = input<string | null>(null);
  created = output<AdminUser>();
  closed = output<void>();

  private userService = inject(UserService);
  private toastService = inject(ToastService);
  private fb = inject(FormBuilder);

  jobTitles = environment.jobTitles;
  roles = computed(() =>
    Object.values(Role).filter(
      (role) =>
        this.forAdmin() || (role !== Role.Admin && role !== Role.Controller),
    ),
  );

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    role: [Role.User as Role, Validators.required],
    jobTitle: [null as string | null],
    organisationId: [null as string | null],
    subOrganisationIds: [[] as string[]],
    onboarding: ['invite' as 'invite' | 'tempPassword'],
  });

  saving = signal(false);
  /** shown once after creating a user with a temporary password */
  tempPassword = signal<{ email: string; password: string } | undefined>(
    undefined,
  );

  constructor() {
    watchScope(this.form, () => this.orgs());
    effect(() => {
      if (!this.forAdmin())
        this.form.controls.organisationId.setValue(this.ownOrganisationId());
    });
  }

  availableSubOrgs(): FullSubOrganisation[] {
    const id = this.form.controls.organisationId.value;
    return this.orgs()?.find((org) => org.id === id)?.subOrganisations ?? [];
  }

  selectedSubOrgs(): FullSubOrganisation[] {
    const ids = this.form.controls.subOrganisationIds.value ?? [];
    return this.availableSubOrgs().filter((subOrg) => ids.includes(subOrg.id));
  }

  subOrgCompareFn = (a: FullSubOrganisation, b: FullSubOrganisation) =>
    a.id === b.id;

  onSubOrgsChange(selected: FullSubOrganisation[]) {
    this.form.controls.subOrganisationIds.setValue(
      selected.map((subOrg) => subOrg.id),
    );
  }

  submit() {
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();

    this.saving.set(true);
    this.userService
      .createUser({
        email: value.email!,
        firstName: value.firstName!,
        lastName: value.lastName!,
        role: value.role!,
        jobTitle: value.jobTitle || null,
        organisationId: value.organisationId || null,
        subOrganisationIds: value.subOrganisationIds ?? [],
        onboarding: value.onboarding!,
      })
      .subscribe({
        next: ({ tempPassword, ...user }) => {
          this.saving.set(false);
          this.toastService.show({
            title: 'Benutzer angelegt',
            text:
              value.onboarding === 'invite'
                ? `Eine Einladung wurde an ${user.email} gesendet.`
                : `Der Benutzer ${user.email} wurde angelegt.`,
            severity: 'success',
          });
          if (tempPassword)
            this.tempPassword.set({ email: user.email, password: tempPassword });
          // stays open, so the temporary password remains visible and the next user can follow
          this.form.reset({
            role: Role.User,
            organisationId: this.forAdmin() ? null : this.ownOrganisationId(),
            subOrganisationIds: [],
            onboarding: 'invite',
          });
          this.created.emit(user);
        },
        // the error toast comes from the http error interceptor
        error: () => this.saving.set(false),
      });
  }
}
