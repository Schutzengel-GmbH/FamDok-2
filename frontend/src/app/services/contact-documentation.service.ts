import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import type {
  ContactDocumentationCreateRequest,
  ContactDocumentationUpdateRequest,
  ContactDocumentationWhere,
} from '../../../../shared/api';
import { FullContactDocumentation } from '../../../../shared/types';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { PersonalDataService } from './personal-data.service';
import {
  matchesContactDocumentation,
  splitContactDocumentationWhere,
} from '../util/crypto/clientFilters';
import { WarningsService } from './warnings.service';
import { toQuery } from '../util/apiUtils';

@Injectable({
  providedIn: 'root',
})
export class ContactDocumentationService {
  private http = inject(HttpClient);
  private warningsService = inject(WarningsService);
  private personal = inject(PersonalDataService);

  protected caseApiUrl = environment.apiUrl + '/case';

  /**
   * Get all (filtered) ContactDocumentation.
   * @param {ContactDocumentationWhere} filter Optional filter
   * @returns {Observable<FullContactDocumentation[]>}
   */
  getDocumentations(
    filter?: ContactDocumentationWhere,
  ): Observable<FullContactDocumentation[]> {
    return this.list('/documentation/all', filter);
  }

  /**
   * Loads a documentation list. In encrypted orgs the filters on the free-text fields and the
   * family name run on the decrypted results instead of the server.
   */
  private list(
    path: string,
    filter?: ContactDocumentationWhere,
  ): Observable<FullContactDocumentation[]> {
    const { server, client } = this.personal.active()
      ? splitContactDocumentationWhere(filter)
      : { server: filter, client: undefined };
    return this.http
      .get<FullContactDocumentation[]>(this.caseApiUrl + path + toQuery({ where: server }))
      .pipe(
        this.personal.decrypting<FullContactDocumentation[]>('ContactDocumentation'),
        map((docs) =>
          client ? docs.filter((d) => matchesContactDocumentation(d, client)) : docs,
        ),
      );
  }

  /**
   * Get all my (filtered) ContactDocumentation.
   * @param {ContactDocumentationWhere} filter Optional filter
   * @returns {Observable<FullContactDocumentation[]>}
   */
  getMyDocumentations(
    filter?: ContactDocumentationWhere,
  ): Observable<FullContactDocumentation[]> {
    return this.list('/documentation/my', filter);
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
    return this.http
      .get<FullContactDocumentation>(
        this.caseApiUrl + '/i/' + caseId + '/documentation/i/' + docId,
      )
      .pipe(this.personal.decrypting('ContactDocumentation'));
  }

  /**
   * Get all (or filtered) Contact Documentation for a case
   * @param {string} caseId UUID of the case
   * @param {ContactDocumentationWhere} filter Optional filter
   * @returns {Observable<FullContactDocumentation>} Observable emitting the Contact Documentation
   */
  getDocumentationForCase(
    caseId: string,
    filter?: ContactDocumentationWhere,
  ): Observable<FullContactDocumentation> {
    return this.list(
      '/i/' + caseId + '/documentation',
      filter,
    ) as unknown as Observable<FullContactDocumentation>;
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
    return this.http
      .get<FullContactDocumentation[]>(
        this.caseApiUrl + '/i/' + caseId + '/documentation/latest' + toQuery({ n }),
      )
      .pipe(this.personal.decrypting('ContactDocumentation'));
  }

  /**
   * Create a new Documentation for a case
   * @param {string} caseId UUID of the case
   * @param {ContactDocumentationCreateRequest} input Create input
   * @returns {Observable<FullContactDocumentation>} Observable emitting the Contact Documentation
   */
  createDocumentation(
    caseId: string,
    input: ContactDocumentationCreateRequest,
  ): Observable<FullContactDocumentation> {
    return this.personal
      .send(
        input,
        () => {
          const id = this.personal.newId();
          return this.personal.prepareContactDocumentation(id, { ...input, id });
        },
        (body) =>
          this.http.post<FullContactDocumentation>(
            this.caseApiUrl + '/i/' + caseId + '/documentation',
            body,
          ),
      )
      .pipe(
        this.personal.decrypting('ContactDocumentation'),
        this.warningsService.refreshAfter(),
      );
  }

  /**
   * Update a Contact Documentation
   * @param {string} caseId UUID of the case
   * @param {string} docId UUID of the Documentation
   * @param {ContactDocumentationUpdateRequest} update Update input
   * @returns {Observable<FullContactDocumentation>} Observable emitting the Contact Documentation
   */
  updateDocumentation(
    caseId: string,
    docId: string,
    update: ContactDocumentationUpdateRequest,
  ): Observable<FullContactDocumentation> {
    return this.personal
      .send(
        update,
        () => this.personal.prepareContactDocumentation(docId, update),
        (body) =>
          this.http.put<FullContactDocumentation>(
            this.caseApiUrl + '/i/' + caseId + '/documentation/i/' + docId,
            body,
          ),
      )
      .pipe(
        this.personal.decrypting('ContactDocumentation'),
        this.warningsService.refreshAfter(),
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
    return this.http
      .delete<FullContactDocumentation>(
        this.caseApiUrl + '/i/' + caseId + '/documentation/i/' + docId,
      )
      .pipe(
        this.personal.decrypting('ContactDocumentation'),
        this.warningsService.refreshAfter(),
      );
  }
}
