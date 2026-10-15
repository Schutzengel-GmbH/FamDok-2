import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  AdminUser,
  FullUser,
  UserWithTempPassword,
} from '../../../../shared/types';
import {
  UserUpdateInput,
  UserWhereInput,
} from '../../../../shared/generated/prisma/models';
import type { UserCreateRequest } from '../../../../shared/zodTypes';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private userApiUrl = environment.apiUrl + '/user';

  getAllUsers(filter?: UserWhereInput) {
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
    });

    return this.http.get<AdminUser[]>(
      this.userApiUrl + '?' + params.toString(),
    );
  }

  getOrgUsers(orgId: string, filter?: UserWhereInput) {
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
    });

    return this.http.get<FullUser[]>(
      this.userApiUrl + '/org/' + orgId + '?' + params.toString(),
    );
  }

  /** Creates the user in Keycloak and the app. Admin only. */
  createUser(user: UserCreateRequest) {
    return this.http.post<UserWithTempPassword>(this.userApiUrl, user);
  }

  /** Sends (again) the Keycloak email to set a password. Admin only. */
  resendInvite(id: string) {
    return this.http.post<void>(this.userApiUrl + '/i/' + id + '/invite', {});
  }

  /** Sets a new temporary password, returned only in this response. Admin only. */
  issueTempPassword(id: string) {
    return this.http.post<{ tempPassword: string }>(
      this.userApiUrl + '/i/' + id + '/temp-password',
      {},
    );
  }

  /** Locks (`false`) or unlocks (`true`) the user's Keycloak account. Admin only. */
  setEnabled(id: string, enabled: boolean) {
    return this.http.put<AdminUser>(this.userApiUrl + '/i/' + id + '/enabled', {
      enabled,
    });
  }

  updateUser(id: string, update: UserUpdateInput) {
    return this.http.put<FullUser>(this.userApiUrl + '/i/' + id, update);
  }

  getUser(id: string) {
    return this.http.get<FullUser>(this.userApiUrl + '/i/' + id);
  }

  deleteUser(id: string) {
    return this.http.delete<FullUser>(this.userApiUrl + '/i/' + id);
  }
}
