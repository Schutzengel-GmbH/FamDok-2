import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  AdminUser,
  FullUser,
  UserWithTempPassword,
} from '../../../../shared/types';
import type {
  OrgUsersQuery,
  UserCreateRequest,
  UserUpdateRequest,
} from '../../../../shared/api';
import { Observable } from 'rxjs';
import { toQuery } from '../util/apiUtils';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private userApiUrl = environment.apiUrl + '/user';

  getAllUsers() {
    return this.http.get<AdminUser[]>(this.userApiUrl);
  }

  getOrgUsers(orgId: string, where?: OrgUsersQuery['where']) {
    return this.http.get<FullUser[]>(
      this.userApiUrl + '/org/' + orgId + toQuery({ where }),
    );
  }

  // helper to use when we expect the user to get managed users returned, i.e. for orgControllers and orgCoordinators
  getManagedOrgUsers(orgId: string) {
    return this.getOrgUsers(orgId) as Observable<AdminUser[]>;
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

  updateUser(id: string, update: UserUpdateRequest) {
    return this.http.put<FullUser>(this.userApiUrl + '/i/' + id, update);
  }

  getUser(id: string) {
    return this.http.get<FullUser>(this.userApiUrl + '/i/' + id);
  }

  deleteUser(id: string) {
    return this.http.delete<FullUser>(this.userApiUrl + '/i/' + id);
  }
}
