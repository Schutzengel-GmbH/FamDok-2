import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import {
  FullCase,
  FullCaseAttachment,
  FullFamily,
  FullUser,
  Handover,
  Settings,
} from '../../../../shared/types';
import { MeService } from './me.service';
import { SettingsService } from './settings.service';
import { triggerBlobDownload } from './document.service';
import {
  CaseCreateInput,
  CaseWhereInput,
  CaseInclude,
  FamilyCreateInput,
  ZielvereinbarungCreateInput,
  ZielvereinbarungUpdateInput,
} from '../../../../shared/generated/prisma/models';
import { mergeMap, Observable } from 'rxjs';
import { Status } from '../../../../shared/generated/prisma/enums';

@Injectable({
  providedIn: 'root',
})
export class CaseService {
  private http = inject(HttpClient);
  private meService = inject(MeService);
  private settingsService = inject(SettingsService);

  protected caseApiUrl = environment.apiUrl + '/case';
  protected familyApiUrl = environment.apiUrl + '/family';

  protected settings!: Settings;

  constructor() {
    this.settingsService.getSettings().subscribe((s) => (this.settings = s));
  }

  /**
   * Fetches cases from the API.
   * @param {CaseWhereInput} [filter] Optional Prisma where filter
   * @returns {Observable<FullCase[]>} Observable emitting an array of cases
   */
  getCases(filter?: CaseWhereInput): Observable<FullCase[]> {
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
    });
    return this.http.get<FullCase[]>(this.caseApiUrl + '?' + params.toString());
  }

  /**
   * Fetches a single case by ID.
   * @param {string} caseId UUID of the case
   * @returns {Observable<FullCase>} Observable emitting the case
   */
  getCase(caseId: string): Observable<FullCase> {
    return this.http.get<FullCase>(this.caseApiUrl + '/i/' + caseId);
  }

  /**
   * Fetches cases where the provided user is responsible.
   * @param {string} userId UUID of the user, can be either the User Id or the User's Keycloak ID
   * @param {CaseWhereInput} [filter] Optional additional Prisma where filter
   * @returns {Observable<FullCase[]>} Observable emitting matching cases
   */
  getCasesForUser(
    userId: string,
    filter?: CaseWhereInput,
  ): Observable<FullCase[]> {
    return this.getCases({
      ...filter,
      responsibleUsers: { some: { OR: [{ id: userId }, { kcId: userId }] } },
    });
  }

  /**
   * Fetches cases for the current authenticated user's dashboard. `scope` picks which cases
   * count as "mine": 'own' (default) only ever returns cases the user is responsible for;
   * 'org'/'subOrg' additionally let an OrgCoordinator/SubOrgCoordinator browse their whole
   * org's/suborg's cases - the backend derives the actual org/suborg from the requesting user
   * and rejects the scope for anyone not permitted to use it.
   * @param {CaseWhereInput} [filter] Optional Prisma where filter
   * @returns {Observable<FullCase[]>} Observable emitting the matching cases
   */
  getMyCases(input: {
    filter?: CaseWhereInput;
    include?: CaseInclude;
    scope?: 'own' | 'org' | 'subOrg';
  }): Observable<FullCase[]> {
    const { filter, include, scope } = input;
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
      include: include ? JSON.stringify(include) : '',
      scope: scope ?? 'own',
    });
    return this.http.get<FullCase[]>(
      this.caseApiUrl + '/my' + '?' + params.toString(),
    );
  }

  /**
   * Creates a family and a related case.
   * The request first creates the family then creates a case that connects to the newly created family.
   *
   * It also makes sure that the family and case are created for the requesting user and attaches the requesting user as
   * the sole responsibleUser for the case as well as attaching family and case to the user's organisation.
   *
   * The `caseInput` parameter is an `Omit<Prisma.CaseCreateInput, 'createdBy' | 'responsibleUsers' | 'family' | 'caseformResponses'>` —
   * callers should provide all case fields except those managed by the server (createdBy, responsibleUsers, family relation and case form responses).
   * Typically `startedAt` will be provided by callers.
   *
   * @param {Prisma.FamilyCreateInput} familyInput Family create input
   * @param {Omit<Prisma.CaseCreateInput, 'createdBy'|'responsibleUsers'|'family'|'caseformResponses'>} caseInput Case create input without server-managed relations
   * @returns {Observable<FullCase>} Observable emitting the created case
   */
  createFamily(
    familyInput: FamilyCreateInput,
    caseInput: Omit<
      CaseCreateInput,
      | 'createdBy'
      | 'responsibleUsers'
      | 'organisation'
      | 'family'
      | 'caseformResponses'
      | 'closedAt'
      | 'closingDocId'
    >,
  ): Observable<FullCase> {
    return this.meService.getMe().pipe(
      mergeMap((user) => {
        if (!user.organisationId)
          throw new Error(
            'Sie sind nicht Teil einer Organisation, Familien/Fälle müssen einer Organisation zugewiesen sein. Kontaktieren sie einen Administrator, falls sie Teil einer Organisation sein sollten.',
          );
        familyInput = {
          ...familyInput,
          organisation: { connect: { id: user.organisationId } },
        };
        caseInput = {
          ...caseInput,
          responsibleUsers: { connect: { id: user.id } },
          createdBy: { connect: { id: user.id } },
          organisation: { connect: { id: user.organisationId } },
          city: (familyInput.adress as PrismaJson.Address).city,
          plz: (familyInput.adress as PrismaJson.Address).plz,
        } as CaseCreateInput;
        return this.http
          .post<FullFamily>(this.familyApiUrl, {
            ...familyInput,
          } as FamilyCreateInput)
          .pipe(
            mergeMap((_family) =>
              this.http.post<FullCase>(this.caseApiUrl, {
                ...caseInput,
                family: { connect: { id: _family.id } },
              }),
            ),
          );
      }),
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
   * Fetches the attachments (e.g. scanned signed consent forms) attached to a case.
   * @param {string} caseId UUID of the case
   * @returns {Observable<FullCaseAttachment[]>} Observable emitting the attachment list
   */
  getAttachments(caseId: string): Observable<FullCaseAttachment[]> {
    return this.http.get<FullCaseAttachment[]>(
      this.caseApiUrl + '/i/' + caseId + '/attachment',
    );
  }

  /**
   * Uploads a file attachment to a case.
   * @param {string} caseId UUID of the case
   * @param {File} file The file to upload
   * @param {string} [note] Optional note describing the attachment
   * @returns {Observable<FullCaseAttachment>} Observable emitting the created attachment
   */
  uploadAttachment(
    caseId: string,
    file: File,
    note?: string,
  ): Observable<FullCaseAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    if (note) formData.append('note', note);
    return this.http.post<FullCaseAttachment>(
      this.caseApiUrl + '/i/' + caseId + '/attachment',
      formData,
    );
  }

  /** Downloads a case attachment and triggers a browser save-as for it. */
  downloadAttachment(caseId: string, attachment: FullCaseAttachment): void {
    this.http
      .get(
        this.caseApiUrl +
          '/i/' +
          caseId +
          '/attachment/i/' +
          attachment.id +
          '/download',
        { responseType: 'blob' },
      )
      .subscribe((blob) => triggerBlobDownload(attachment.filename, blob));
  }

  /**
   * Deletes a case attachment.
   * @param {string} caseId UUID of the case
   * @param {string} attachmentId UUID of the attachment to delete
   * @returns {Observable<FullCaseAttachment>} Observable emitting the deleted attachment
   */
  deleteAttachment(
    caseId: string,
    attachmentId: string,
  ): Observable<FullCaseAttachment> {
    return this.http.delete<FullCaseAttachment>(
      this.caseApiUrl + '/i/' + caseId + '/attachment/i/' + attachmentId,
    );
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
