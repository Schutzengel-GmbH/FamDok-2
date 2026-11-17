import {
  Component,
  computed,
  inject,
  signal,
  WritableSignal,
} from '@angular/core';
import { UserService } from 'src/app/services/user.service';
import { AdminUser, FullOrganisation } from '../../../../../shared/types';
import { UserItemComponent } from './user-item/user-item.component';
import { OrgService } from 'src/app/services/organisation.service';
import { ToastService } from 'src/app/services/toast.service';
import { FormsModule } from '@angular/forms';
import { UserCreateComponent } from './user-create/user-create.component';
import { MeService } from 'src/app/services/me.service';
import { map, mergeMap } from 'rxjs';
import { Role } from '../../../../../shared/generated/prisma/enums';
import { AsyncPipe } from '@angular/common';

function userFilter(f: string) {
  return (user: AdminUser) => {
    const filter = f.toLocaleLowerCase();
    return (
      user.email.toLocaleLowerCase().includes(filter) ||
      user.firstName?.toLocaleLowerCase().includes(filter) ||
      user.lastName?.toLocaleLowerCase().includes(filter) ||
      user.organisation?.name.toLocaleLowerCase().includes(filter) ||
      // user.subOrganisations.some((so) => so.name.includes(filter)) ||
      user.jobTitle?.toLocaleLowerCase().includes(filter) ||
      user.role.toLocaleLowerCase().includes(filter)
    );
  };
}

@Component({
  selector: 'app-user-admin',
  templateUrl: './user-admin.component.html',
  styleUrl: './user-admin.component.scss',
  standalone: true,
  imports: [AsyncPipe, UserItemComponent, UserCreateComponent, FormsModule],
})
export class UserAdminComponent {
  private meService = inject(MeService);
  private userService = inject(UserService);
  private orgService = inject(OrgService);

  user$ = this.meService.getMe();

  orgs!: FullOrganisation[];
  readonly toastService = inject(ToastService);

  protected users: WritableSignal<AdminUser[]> = signal([]);
  protected filteredUsers = computed(() =>
    this.users().filter(userFilter(this.filter())),
  );
  filter = signal('');
  creating = signal(false);

  constructor() {
    this.user$
      .pipe(
        mergeMap((user) =>
          user.role === Role.Admin
            ? this.userService.getAllUsers()
            : this.userService.getManagedOrgUsers(user.organisationId!),
        ),
      )
      .subscribe((users) => this.users.set(users));
    this.orgService.getAll().subscribe((o) => (this.orgs = o));
  }

  onCreated(user: AdminUser) {
    this.users.update((users) => [user, ...users]);
  }
}
