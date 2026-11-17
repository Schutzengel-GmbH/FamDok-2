import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { ChildModel as Child } from '../../../../shared/generated/prisma/models';
import { FullFamily } from '../../../../shared/types';
import type {
  ChildHealthDataRequest,
  FamilyUpdateRequest,
} from '../../../../shared/api';
import { firstValueFrom, map, Observable } from 'rxjs';
import { PersonalDataService } from './personal-data.service';

@Injectable({
  providedIn: 'root',
})
export class FamilyService {
  private http = inject(HttpClient);
  private personal = inject(PersonalDataService);

  protected familyApiUrl = environment.apiUrl + '/family';

  /**
   * Fetches a single Family by ID.
   * @param {string} id UUID of the family
   * @returns {Observable<FullFamily>} Observable emitting the Family
   */
  getFamily(id: string): Observable<FullFamily> {
    return this.http
      .get<FullFamily>(this.familyApiUrl + '/i/' + id)
      .pipe(this.personal.decrypting('Family'));
  }

  /**
   * Fetches the HealthData for a given child
   * @param {string} familyId UUID of the family
   * @param {string} childId UUID of the child
   * @returns {Observable<PrismaJson.HealthDataPointChild[]>} Health data array for the child
   */
  getHealthData(
    familyId: string,
    childId: string,
  ): Observable<PrismaJson.HealthDataPointChild[]> {
    return this.getChild(familyId, childId).pipe(map((c) => c.healthData));
  }

  /** A child of a family, decrypted. */
  private getChild(familyId: string, childId: string): Observable<Child> {
    return this.http
      .get<Child>(this.familyApiUrl + '/i/' + familyId + '/children/' + childId)
      .pipe(this.personal.decrypting('Child'));
  }

  /**
   * Updates a family by ID.
   * @param {string} id UUID of the family
   * @param {FamilyUpdateRequest} update Update data
   * @returns {Observable<FullFamily>} Observable emitting the updated family
   */
  updateFamily(id: string, update: FamilyUpdateRequest): Observable<FullFamily> {
    // the family's blob holds all its personal fields, so a partial update needs the rest
    return this.personal
      .send(
        update,
        async () =>
          this.personal.prepareFamilyUpdate(await firstValueFrom(this.getFamily(id)), update),
        (body) => this.http.put<FullFamily>(this.familyApiUrl + '/i/' + id, body),
      )
      .pipe(this.personal.decrypting('Family'));
  }

  /**
   * Replaces a child's full healthData array.
   * @param {string} familyId UUID of the family
   * @param {string} childId UUID of the child
   * @param {ChildHealthDataRequest['healthData']} healthData The new full healthData array
   * @returns {Observable<FullFamily>} Observable emitting the updated family
   */
  updateHealthData(
    familyId: string,
    childId: string,
    healthData: NonNullable<ChildHealthDataRequest['healthData']>,
  ): Observable<FullFamily> {
    return this.personal
      .send(
        { healthData } as ChildHealthDataRequest,
        async () =>
          this.personal.prepareHealthData(
            await firstValueFrom(this.getChild(familyId, childId)),
            healthData,
          ),
        (body) =>
          this.http.put<FullFamily>(
            `${this.familyApiUrl}/i/${familyId}/children/${childId}/health-data`,
            body,
          ),
      )
      .pipe(this.personal.decrypting('Family'));
  }

  /**
   * Deletes a family by ID.
   * @param {string} id UUID of the family
   * @returns {Observable<FullFamily>} Observable emitting the deleted family or deletion result
   */
  deleteFamily(id: string): Observable<FullFamily> {
    return this.http
      .delete<FullFamily>(this.familyApiUrl + '/i/' + id)
      .pipe(this.personal.decrypting('Family'));
  }
}
