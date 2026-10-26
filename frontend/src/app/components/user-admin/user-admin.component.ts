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
  standalone: true,
  imports: [UserItemComponent, UserCreateComponent, FormsModule],
})
export class UserAdminComponent {
  private userService = inject(UserService);
  private orgService = inject(OrgService);
  orgs!: FullOrganisation[];
  readonly toastService = inject(ToastService);

  protected users: WritableSignal<AdminUser[]> = signal([]);
  protected filteredUsers = computed(() =>
    this.users().filter(userFilter(this.filter())),
  );
  filter = signal('');
  creating = signal(false);

  constructor() {
    this.userService.getAllUsers().subscribe((u) => this.users.set(u));
    this.orgService.getAll().subscribe((o) => (this.orgs = o));
  }

  onCreated(user: AdminUser) {
    this.users.update((users) => [user, ...users]);
  }
}
