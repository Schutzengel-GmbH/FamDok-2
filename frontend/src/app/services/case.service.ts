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
  caseExportFilename,
  stammdatenFilename,
} from '../../../../shared/utils/filename';
import { map, Observable } from 'rxjs';
import { Status } from '../../../../shared/generated/prisma/enums';
import type {
  CaseCreateRequest,
  CaseWhere,
  HandoverRequest,
  MyCasesQuery,
  ZielCreateRequest,
  ZielUpdateRequest,
} from '../../../../shared/api';
import { toQuery } from '../util/apiUtils';

@Injectable({
  providedIn: 'root',
})
export class CaseService {
  private http = inject(HttpClient);
  private meService = inject(MeService);
  private settingsService = inject(SettingsService);

  protected caseApiUrl = environment.apiUrl + '/case';

  protected settings!: Settings;

  constructor() {
    this.settingsService.getSettings().subscribe((s) => (this.settings = s));
  }

  /**
   * Fetches cases from the API.
   * @param {CaseWhere} [filter] Optional Prisma where filter
   * @returns {Observable<FullCase[]>} Observable emitting an array of cases
   */
  getCases(filter?: CaseWhere): Observable<FullCase[]> {
    return this.http.get<FullCase[]>(
      this.caseApiUrl + toQuery({ where: filter }),
    );
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
   * Fetches cases for the current authenticated user's dashboard. `scope` picks which cases
   * count as "mine": 'own' (default) only ever returns cases the user is responsible for;
   * 'org'/'subOrg' additionally let an OrgCoordinator/SubOrgCoordinator browse their whole
   * org's/suborg's cases - the backend derives the actual org/suborg from the requesting user
   * and rejects the scope for anyone not permitted to use it.
   * @param {MyCasesQuery} query Optional filter, scope and preset
   * @returns {Observable<FullCase[]>} Observable emitting the matching cases
   */
  getMyCases(query: MyCasesQuery = {}): Observable<FullCase[]> {
    return this.http.get<FullCase[]>(
      this.caseApiUrl + '/my' + toQuery(query),
    );
  }

  /**
   * Creates a new case together with its family, in the user's own organisation.
   * @param {CaseCreateRequest} request The case and its family
   * @returns {Observable<FullCase>} Observable emitting the created case
   */
  createCase(request: CaseCreateRequest): Observable<FullCase> {
    return this.http.post<FullCase>(this.caseApiUrl, request);
  }

  /**
   * Adds a Zielvereinbarung to a case.
   * @param {string} caseId UUID of the case
   * @param {ZielCreateRequest} ziel Zielvereinbarung to create
   * @returns {Observable<FullCase>} Observable emitting the updated case
   */
  addZiel(
    caseId: string,
    ziel: ZielCreateRequest,
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
   * @param {ZielUpdateRequest} update Update input
   * @returns {Observable<FullCase>} Observable emitting the updated case
   */
  updateZiel(
    caseId: string,
    zielId: string,
    update: ZielUpdateRequest,
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
   * Download the case's Stammdaten (case + family data) as a PDF
   * @param {string} caseId UUID of the case
   * @param {string} familyName used for the file name
   */
  downloadStammdatenPDF(caseId: string, familyName: string): Observable<void> {
    return this.http
      .get(this.caseApiUrl + '/i/' + caseId + '/export/stammdaten', {
        responseType: 'blob',
      })
      .pipe(
        map((blob) =>
          triggerBlobDownload(stammdatenFilename(familyName), blob),
        ),
      );
  }

  /**
   * Download the case's full history as a ZIP: Stammdaten PDF, all contact documentation as
   * PDFs and all case form responses as CSVs
   * @param {string} caseId UUID of the case
   * @param {string} familyName used for the file name
   */
  downloadCaseExport(caseId: string, familyName: string): Observable<void> {
    return this.http
      .get(this.caseApiUrl + '/i/' + caseId + '/export', {
        responseType: 'blob',
      })
      .pipe(
        map((blob) =>
          triggerBlobDownload(caseExportFilename(familyName), blob),
        ),
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
   * @param {HandoverRequest} handover Handover to perform
   * @returns {Observable<FullCase>} Observable emitting the updated case
   */
  handover(handover: HandoverRequest): Observable<FullCase> {
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
