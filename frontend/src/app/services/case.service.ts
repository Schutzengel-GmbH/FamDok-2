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
import { from, map, Observable, of, switchMap } from 'rxjs';
import { PersonalDataService } from './personal-data.service';
import { matchesFamily, splitCaseWhere } from '../util/crypto/clientFilters';
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
  private personal = inject(PersonalDataService);

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
    if (!this.personal.active())
      return this.http
        .get<FullCase[]>(this.caseApiUrl + toQuery({ where: filter }))
        .pipe(this.personal.decrypting('Case'));
    // the family name is encrypted, so that part of the filter runs on the decrypted cases
    const { server, family } = splitCaseWhere(filter);
    return this.http
      .get<FullCase[]>(this.caseApiUrl + toQuery({ where: server }))
      .pipe(
        this.personal.decrypting<FullCase[]>('Case'),
        map((cases) => (family ? cases.filter((c) => matchesFamily(c, family)) : cases)),
      );
  }

  /**
   * Fetches a single case by ID.
   * @param {string} caseId UUID of the case
   * @returns {Observable<FullCase>} Observable emitting the case
   */
  getCase(caseId: string): Observable<FullCase> {
    return this.http
      .get<FullCase>(this.caseApiUrl + '/i/' + caseId)
      .pipe(this.personal.decrypting('Case'));
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
    const { server, family } = this.personal.active()
      ? splitCaseWhere(query.where)
      : { server: query.where, family: undefined };
    return this.http
      .get<FullCase[]>(
        this.caseApiUrl + '/my' + toQuery({ ...query, where: server }),
      )
      .pipe(
        this.personal.decrypting<FullCase[]>('Case'),
        map((cases) => (family ? cases.filter((c) => matchesFamily(c, family)) : cases)),
      );
  }

  /**
   * Creates a new case together with its family, in the user's own organisation.
   * @param {CaseCreateRequest} request The case and its family
   * @returns {Observable<FullCase>} Observable emitting the created case
   */
  createCase(request: CaseCreateRequest): Observable<FullCase> {
    return this.personal
      .send(
        request,
        () => this.personal.prepareCaseCreate(request),
        (body) => this.http.post<FullCase>(this.caseApiUrl, body),
      )
      .pipe(this.personal.decrypting('Case'));
  }

  /**
   * Adds a Zielvereinbarung to a case.
   * @param {string} caseId UUID of the case
   * @param {ZielCreateRequest} ziel Zielvereinbarung to create
   * @returns {Observable<FullCase>} Observable emitting the updated case
   */
  addZiel(caseId: string, ziel: ZielCreateRequest): Observable<FullCase> {
    return this.personal
      .send(
        ziel,
        () => {
          const id = this.personal.newId();
          return this.personal.prepareZiel(id, { ...ziel, id });
        },
        (body) =>
          this.http.post<FullCase>(
            this.caseApiUrl + '/i/' + caseId + '/ziel',
            body,
          ),
      )
      .pipe(this.personal.decrypting('Case'));
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
    return this.personal
      .send(
        update,
        () => this.personal.prepareZiel(zielId, update),
        (body) =>
          this.http.put<FullCase>(
            this.caseApiUrl + '/i/' + caseId + '/ziel/' + zielId,
            body,
          ),
      )
      .pipe(this.personal.decrypting('Zielvereinbarung'));
  }

  /**
   * Deletes a Zielvereinbarung from a case.
   * @param {string} caseId UUID of the case
   * @param {string} zielId UUID of the Zielvereinbarung to delete
   * @returns {Observable<FullCase>} Observable emitting the updated case
   */
  deleteZiel(caseId: string, zielId: string): Observable<FullCase> {
    return this.http
      .delete<FullCase>(this.caseApiUrl + '/i/' + caseId + '/ziel/' + zielId)
      .pipe(this.personal.decrypting('Zielvereinbarung'));
  }

  /** Closes a case. Note that this does not handle redirection to a closing survey.
   * @param {string} caseId UUID of the case
   * @param {Date} date Date
   * @returns {Observable<FullCase>} closed Case
   */
  closeCase(caseId: string, date: Date): Observable<FullCase> {
    return this.http
      .post<FullCase>(this.caseApiUrl + '/close/' + caseId, { date })
      .pipe(this.personal.decrypting('Case'));
  }

  /** Reverts a case's closure. This deletes the case's existing Abschlussdokumentation, if any.
   * @param {string} caseId UUID of the case
   * @returns {Observable<FullCase>} reopened Case
   */
  reopenCase(caseId: string): Observable<FullCase> {
    return this.http
      .post<FullCase>(this.caseApiUrl + '/reopen/' + caseId, {})
      .pipe(this.personal.decrypting('Case'));
  }

  /** Immediately purges a case's family's personal data, skipping any waiting period.
   * @param {string} caseId UUID of the case
   * @returns {Observable<FullCase>} updated Case
   */
  purgeFamily(caseId: string): Observable<FullCase> {
    return this.http
      .post<FullCase>(this.caseApiUrl + '/i/' + caseId + '/purge', {})
      .pipe(this.personal.decrypting('Case'));
  }

  /**
   * Get the list of handovers for a case.
   * @param {string} caseId UUID of the case
   * @returns {Observable<(Handover & {added: FullUser[], removed: FullUser[]})[]>} Array of handovers
   */
  getHandovers(
    caseId: string,
  ): Observable<(Handover & { added: FullUser[]; removed: FullUser[] })[]> {
    return this.http
      .get<(Handover & { added: FullUser[]; removed: FullUser[] })[]>(
        this.caseApiUrl + '/handover/' + caseId,
      )
      .pipe(this.personal.decrypting('Handover'));
  }

  /**
   * Perform a handover of a case.
   * @param {HandoverRequest} handover Handover to perform
   * @returns {Observable<FullCase>} Observable emitting the updated case
   */
  handover(handover: HandoverRequest): Observable<FullCase> {
    return this.personal
      .send(
        handover,
        () => this.personal.prepareHandover(handover),
        (body) => this.http.post<FullCase>(this.caseApiUrl + '/handover', body),
      )
      .pipe(this.personal.decrypting('Case'));
  }

  /**
   * Fetches the attachments (e.g. scanned signed consent forms) attached to a case.
   * @param {string} caseId UUID of the case
   * @returns {Observable<FullCaseAttachment[]>} Observable emitting the attachment list
   */
  getAttachments(caseId: string): Observable<FullCaseAttachment[]> {
    return this.http
      .get<FullCaseAttachment[]>(
        this.caseApiUrl + '/i/' + caseId + '/attachment',
      )
      .pipe(this.personal.decrypting('CaseAttachment'));
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
    return this.personal
      .send(
        null,
        () => this.personal.prepareAttachment(file, note),
        (prepared) => {
          const formData = new FormData();
          if (prepared?.encrypted) {
            // text fields first: the server reads them before it stores the file
            formData.append('id', prepared.id);
            formData.append('filename', prepared.filename);
            formData.append('mimeType', prepared.mimeType);
            if (prepared.note) formData.append('note', prepared.note);
            formData.append('file', prepared.content, 'encrypted.bin');
          } else {
            formData.append('file', file);
            if (note) formData.append('note', note);
          }
          return this.http.post<FullCaseAttachment>(
            this.caseApiUrl + '/i/' + caseId + '/attachment',
            formData,
          );
        },
      )
      .pipe(this.personal.decrypting('CaseAttachment'));
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
      .pipe(
        switchMap((blob) =>
          attachment.contentKeyVersion === null ||
          attachment.contentKeyVersion === undefined
            ? of(blob)
            : from(this.personal.decryptAttachmentContent(attachment, blob)),
        ),
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
    return this.http
      .delete<FullCaseAttachment>(
        this.caseApiUrl + '/i/' + caseId + '/attachment/i/' + attachmentId,
      )
      .pipe(this.personal.decrypting('CaseAttachment'));
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
