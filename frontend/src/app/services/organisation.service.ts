import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { UserService } from './user.service';
import { FullOrganisation } from '../../../../shared/types';
import {
  OrganisationCreateInput,
  OrganisationUpdateInput,
} from '../../../../shared/generated/prisma/models';

@Injectable({
  providedIn: 'root',
})
export class OrgService {
  private http = inject(HttpClient);
  private userService = inject(UserService);
  private orgApiUrl = environment.apiUrl + '/org';

  /**
   * Get all organisations
   * @returns
   */
  getAll() {
    return this.http.get<FullOrganisation[]>(this.orgApiUrl);
  }

  /**
   * Get organisation by ID
   * @param id organisation ID
   * @returns
   */
  get(id: string) {
    return this.http.get<FullOrganisation>(this.orgApiUrl + '/i/' + id);
  }

  /**
   * Update organisation
   * @param id organisation ID
   * @param update
   * @returns
   */
  update(id: string, update: OrganisationUpdateInput) {
    return this.http.put<FullOrganisation>(
      this.orgApiUrl + '/i/' + id,
      update,
    );
  }

  /**
   * Create a new Organisation
   * @param data
   * @returns
   */
  create(data: OrganisationCreateInput) {
    return this.http.post<FullOrganisation>(this.orgApiUrl, data);
  }

  /**
   * Delete an organisation
   * @param id organisation ID
   * @returns
   */
  delete(id: string) {
    return this.http.delete<FullOrganisation>(
      this.orgApiUrl + '/i/' + id,
    );
  }

  /**
   * Add a user to an organisation
   * @param userId user ID
   * @param orgId organisation ID
   * @returns
   */
  addUser(userId: string, orgId: string) {
    return this.userService.updateUser(userId, {
      organisation: { connect: { id: orgId } },
    });
  }
}
