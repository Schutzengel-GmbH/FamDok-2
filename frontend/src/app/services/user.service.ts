import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { FullUser } from '../../../../shared/types';
import {
  UserCreateInput,
  UserUpdateInput,
  UserWhereInput,
} from '../../../../shared/generated/prisma/models';

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

    return this.http.get<FullUser[]>(
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

  createUser(user: UserCreateInput) {
    return this.http.post<FullUser>(this.userApiUrl, user);
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
