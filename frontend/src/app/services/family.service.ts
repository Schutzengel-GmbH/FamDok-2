import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import {
  ChildModel as Child,
  FamilyUpdateInput,
  FamilyWhereInput,
} from '../../../../shared/generated/prisma/models';
import { FullFamily } from '../../../../shared/types';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FamilyService {
  private http = inject(HttpClient);

  protected familyApiUrl = environment.apiUrl + '/family';

  /**
   * Fetches families from the API.
   * @param {FamilyWhereInput} [filter] Optional Prisma where filter
   * @returns {Observable<FullFamily[]>} Observable emitting an array of families
   */
  getFamilies(filter?: FamilyWhereInput): Observable<FullFamily[]> {
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
    });
    return this.http.get<FullFamily[]>(
      this.familyApiUrl + '?' + params.toString(),
    );
  }

  /**
   * Fetches a single Family by ID.
   * @param {string} id UUID of the family
   * @returns {Observable<FullFamily>} Observable emitting the Family
   */
  getFamily(id: string): Observable<FullFamily> {
    return this.http.get<FullFamily>(this.familyApiUrl + '/i/' + id);
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
    return this.http
      .get<Child>(this.familyApiUrl + '/i/' + familyId + '/children/' + childId)
      .pipe(map((c) => c.healthData));
  }

  /**
   * Updates a family by ID.
   * @param {string} id UUID of the family
   * @param {FamilyUpdateInput} update Update data
   * @returns {Observable<FullFamily>} Observable emitting the updated family
   */
  updateFamily(id: string, update: FamilyUpdateInput): Observable<FullFamily> {
    return this.http.put<FullFamily>(this.familyApiUrl + '/i/' + id, update);
  }

  /**
   * Replaces a child's full healthData array.
   * @param {string} familyId UUID of the family
   * @param {string} childId UUID of the child
   * @param {PrismaJson.HealthDataPointChild[]} healthData The new full healthData array
   * @returns {Observable<FullFamily>} Observable emitting the updated family
   */
  updateHealthData(
    familyId: string,
    childId: string,
    healthData: PrismaJson.HealthDataPointChild[],
  ): Observable<FullFamily> {
    return this.updateFamily(familyId, {
      children: {
        update: {
          where: { id: childId },
          data: { healthData },
        },
      },
    });
  }

  /**
   * Deletes a family by ID.
   * @param {string} id UUID of the family
   * @returns {Observable<FullFamily>} Observable emitting the deleted family or deletion result
   */
  deleteFamily(id: string): Observable<FullFamily> {
    return this.http.delete<FullFamily>(this.familyApiUrl + '/i/' + id);
  }
}
