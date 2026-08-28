import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { Status } from '../../../../shared/generated/prisma/enums';
import {
  ChildModel as Child,
  ContactDocumentationCreateInput,
  ContactDocumentationUpdateInput,
  ContactDocumentationWhereInput,
  FamilyUpdateInput,
  FamilyWhereInput,
  CaseFormResponseCreateInput,
  CaseFormResponseUpdateInput,
  ZielvereinbarungCreateInput,
  ZielvereinbarungUpdateInput,
} from '../../../../shared/generated/prisma/models';
import {
  FullCase,
  FullCaseFormResponse,
  FullContactDocumentation,
  FullFamily,
  FullUser,
  Handover,
  Settings,
} from '../../../../shared/types';
import { map, mergeMap, Observable } from 'rxjs';
import { MeService } from './me.service';
import { unique } from '../util/generalUtils';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class FamilyService {
  private http = inject(HttpClient);
  private meService = inject(MeService);
  private settingsService = inject(SettingsService);

  protected familyApiUrl = environment.apiUrl + '/family';
  protected caseApiUrl = environment.apiUrl + '/case';
  protected caseFormResponseApiUrl = environment.apiUrl + '/case-form-response';

  protected settings!: Settings;

  constructor() {
    this.settingsService.getSettings().subscribe((s) => (this.settings = s));
  }

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
   * Deletes a family by ID.
   * @param {string} id UUID of the family
   * @returns {Observable<FullFamily>} Observable emitting the deleted family or deletion result
   */
  deleteFamily(id: string): Observable<FullFamily> {
    return this.http.delete<FullFamily>(this.familyApiUrl + '/i/' + id);
  }

  /**
   * Creates a case form response.
   * @param {CaseFormResponseCreateInput} caseFormResponsedata Create input
   * @returns {Observable<FullCaseFormResponse>} Observable emitting the created response
   */
  createCaseFormResponse(
    caseFormResponsedata: CaseFormResponseCreateInput,
  ): Observable<FullCaseFormResponse> {
    return this.http.post<FullCaseFormResponse>(
      this.caseFormResponseApiUrl,
      caseFormResponsedata,
    );
  }

  /**
   * Updates a case form response by ID.
   * @param {string} id UUID of the response
   * @param {CaseFormResponseUpdateInput} update Update input
   * @returns {Observable<FullCaseFormResponse>} Observable emitting the updated response
   */
  updateCaseFormResponse(
    id: string,
    update: CaseFormResponseUpdateInput,
  ): Observable<FullCaseFormResponse> {
    return this.http.put<FullCaseFormResponse>(
      this.caseFormResponseApiUrl + '/i/' + id,
      update,
    );
  }

  /**
   * Deletes a case form response by ID.
   * @param {string} id UUID of the response
   * @returns {Observable<FullCaseFormResponse>} Observable emitting the deleted response or deletion result
   */
  deleteCaseFormResponse(id: string): Observable<FullCaseFormResponse> {
    return this.http.delete<FullCaseFormResponse>(
      this.caseFormResponseApiUrl + '/i/' + id,
    );
  }

  /**
   * Adds a Zielvereinbarung to a case.
   * @param {string} caseId UUID of the case
   * @param {ZielvereinbarungCreateInput} ziel Zielvereinbarung create input
   * @returns {Observable<FullCase>} Observable emitting the updated case
   */
  addZiel(
    caseId: string,
    ziel: ZielvereinbarungCreateInput,
  ): Observable<FullCase> {
    return this.http.post<FullCase>(
      this.caseApiUrl + '/i/' + caseId + '/ziel',
      ziel,
    );
  }

  /**
   * Updates a Zielvereinbarung on a case.
   * @param {string} caseId UUID of the case
   * @param {string} zielId UUID of the Zielvereinbarung
   * @param {ZielvereinbarungUpdateInput} update Update input
   * @returns {Observable<FullCase>} Observable emitting the updated case
   */
  updateZiel(
    caseId: string,
    zielId: string,
    update: ZielvereinbarungUpdateInput,
  ): Observable<FullCase> {
    return this.http.put<FullCase>(
      this.caseApiUrl + '/i/' + caseId + '/ziel/' + zielId,
      update,
    );
  }

  /**
   * Deletes a Zielvereinbarung from a case.
   * @param {string} caseId UUID of the case
   * @param {string} zielId UUID of the Zielvereinbarung to delete
   * @returns {Observable<FullCase>} Observable emitting the updated case
   */
  deleteZiel(caseId: string, zielId: string): Observable<FullCase> {
    return this.http.delete<FullCase>(
      this.caseApiUrl + '/i/' + caseId + '/ziel/' + zielId,
    );
  }

  /**
   * Get all (filtered) ContactDocumentation.
   * @param {ContactDocumentationWhereInput} filter Prisma Where Input filter
   * @returns {Observable<FullContactDocumentation[]>}
   */
  getDocumentations(
    filter?: ContactDocumentationWhereInput,
  ): Observable<FullContactDocumentation[]> {
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
    });
    return this.http.get<FullContactDocumentation[]>(
      this.caseApiUrl + '/documentation/all?' + params.toString(),
    );
  }

  /**
   * Get all my (filtered) ContactDocumentation.
   * @param {ContactDocumentationWhereInput} filter Prisma Where Input filter
   * @returns {Observable<FullContactDocumentation[]>}
   */
  getMyDocumentations(
    filter?: ContactDocumentationWhereInput,
  ): Observable<FullContactDocumentation[]> {
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
    });
    return this.http.get<FullContactDocumentation[]>(
      this.caseApiUrl + '/documentation/my?' + params.toString(),
    );
  }

  /**
   * Get a Contact Documentation by ID.
   * @param {string} caseId UUID of the case
   * @param {string} docId UUID of the Documentation
   * @returns {Observable<FullContactDocumentation>} Observable emitting the Contact Documentation
   */
  getDocumentation(
    caseId: string,
    docId: string,
  ): Observable<FullContactDocumentation> {
    return this.http.get<FullContactDocumentation>(
      this.caseApiUrl + '/i/' + caseId + '/documentation/i/' + docId,
    );
  }

  /**
   * Download a PDF for the contact documentation
   * @param {string} caseId UUID of the case
   * @param {string} docId UUID of the Documentation
   */
  downloadContactDocumentationPDF(caseId: string, docId: string) {
    this.http
      .get(
        this.caseApiUrl +
          '/i/' +
          caseId +
          '/documentation/i/' +
          docId +
          '/download',
        { responseType: 'blob' },
      )
      .subscribe({
        next: (blob) => {
          const filename = `doc.pdf`;
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          anchor.click();
          URL.revokeObjectURL(url);
        },
        error: () => {},
      });
  }

  /**
   * Get all (or filtered) Contact Documentation for a case
   * @param {string} caseId UUID of the case
   * @param {ContactDocumentationWhereInput} filter Prisma Where Input filter
   * @returns {Observable<FullContactDocumentation>} Observable emitting the Contact Documentation
   */
  getDocumentationForCase(
    caseId: string,
    filter?: ContactDocumentationWhereInput,
  ): Observable<FullContactDocumentation> {
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
    });
    return this.http.get<FullContactDocumentation>(
      this.caseApiUrl +
        '/i/' +
        caseId +
        '/documentation' +
        '?' +
        params.toString(),
    );
  }

  /**
   * Get latest Contact Documentation for a case
   * @param {string} caseId UUID of the case
   * @param {number} n [optional] number of documentations to return, server defaults to 5
   * @returns {Observable<FullContactDocumentation[]>} Observable emitting the Contact Documentation
   */
  getLatestDocumentationForCase(
    caseId: string,
    n?: number,
  ): Observable<FullContactDocumentation[]> {
    return this.http.get<FullContactDocumentation[]>(
      this.caseApiUrl + '/i/' + caseId + '/documentation/latest',
      { params: n ? { n } : undefined },
    );
  }

  /**
   * Create a new Documentation for a case
   * @param {string} caseId UUID of the case
   * @param {ContactDocumentationCreateInput} input Prisma Create input
   * @returns {Observable<FullContactDocumentation>} Observable emitting the Contact Documentation
   */
  createDocumentation(
    caseId: string,
    input: ContactDocumentationCreateInput,
  ): Observable<FullContactDocumentation> {
    return this.http.post<FullContactDocumentation>(
      this.caseApiUrl + '/i/' + caseId + '/documentation',
      input,
    );
  }

  /**
   * Update a Contact Documentation
   * @param {string} caseId UUID of the case
   * @param {string} docId UUID of the Documentation
   * @param {ContactDocumentationUpdateInput} update Prisma Update input
   * @returns {Observable<FullContactDocumentation>} Observable emitting the Contact Documentation
   */
  updateDocumentation(
    caseId: string,
    docId: string,
    update: ContactDocumentationUpdateInput,
  ): Observable<FullContactDocumentation> {
    return this.http.put<FullContactDocumentation>(
      this.caseApiUrl + '/i/' + caseId + '/documentation/i/' + docId,
      update,
    );
  }

  /**
   * Get a Contact Documentation by ID.
   * @param {string} caseId UUID of the case
   * @param {string} docId UUID of the Documentation
   * @returns {Observable<FullContactDocumentation>} Observable emitting the Contact Documentation
   */
  deleteDocumentation(
    caseId: string,
    docId: string,
  ): Observable<FullContactDocumentation> {
    return this.http.delete<FullContactDocumentation>(
      this.caseApiUrl + '/i/' + caseId + '/documentation/i/' + docId,
    );
  }

  /** Closes a case. Note that this does not handle redirection to a closing survey.
   * @param {string} caseId UUID of the case
   * @param {Date} date Date
   * @returns {Observable<FullCase>} closed Case
   */
  closeCase(caseId: string, date: Date): Observable<FullCase> {
    return this.http.post<FullCase>(this.caseApiUrl + '/close/' + caseId, {
      date,
    });
  }

  /** Reverts a case's closure. This deletes the case's existing Abschlussdokumentation, if any.
   * @param {string} caseId UUID of the case
   * @returns {Observable<FullCase>} reopened Case
   */
  reopenCase(caseId: string): Observable<FullCase> {
    return this.http.post<FullCase>(this.caseApiUrl + '/reopen/' + caseId, {});
  }

  /** Immediately purges a case's family's personal data, skipping any waiting period.
   * @param {string} caseId UUID of the case
   * @returns {Observable<FullCase>} updated Case
   */
  purgeFamily(caseId: string): Observable<FullCase> {
    return this.http.post<FullCase>(
      this.caseApiUrl + '/i/' + caseId + '/purge',
      {},
    );
  }

  /**
   * Get the list of handovers for a case.
   * @param {string} caseId UUID of the case
   * @returns {Observable<(Handover & {added: FullUser[], removed: FullUser[]})[]>} Array of handovers
   */
  getHandovers(
    caseId: string,
  ): Observable<(Handover & { added: FullUser[]; removed: FullUser[] })[]> {
    return this.http.get<
      (Handover & { added: FullUser[]; removed: FullUser[] })[]
    >(this.caseApiUrl + '/handover/' + caseId);
  }

  /**
   * Perform a handover of a case.
   * @param {Handover} handover Handover to perform
   * @returns {Observable<FullCase>} Observable emitting the updated case
   */
  handover(handover: Handover): Observable<FullCase> {
    return this.http.post<FullCase>(this.caseApiUrl + '/handover', handover);
  }

  /**
   * Filter function that returns true if at least one case is still inProgress, false otherwise
   */
  filterInProgress(case_: FullCase) {
    return case_.zielvereinbarungen.some((z) => z.status === Status.inProgress);
  }

  /**
   * Filter function that returns true if at least one case is still inProgress, false otherwise
   */
  filterNotInProgress(case_: FullCase) {
    return case_.zielvereinbarungen.every(
      (z) => z.status !== Status.inProgress,
    );
  }
}
