import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  ContactDocumentationCreateRequest,
  ContactDocumentationUpdateRequest,
  ContactDocumentationWhere,
} from '../../../../shared/api';
import { FullContactDocumentation } from '../../../../shared/types';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { triggerBlobDownload } from './document.service';
import { WarningsService } from './warnings.service';
import { toQuery } from '../util/apiUtils';

@Injectable({
  providedIn: 'root',
})
export class ContactDocumentationService {
  private http = inject(HttpClient);
  private warningsService = inject(WarningsService);

  protected caseApiUrl = environment.apiUrl + '/case';

  /**
   * Get all (filtered) ContactDocumentation.
   * @param {ContactDocumentationWhere} filter Optional filter
   * @returns {Observable<FullContactDocumentation[]>}
   */
  getDocumentations(
    filter?: ContactDocumentationWhere,
  ): Observable<FullContactDocumentation[]> {
    return this.http.get<FullContactDocumentation[]>(
      this.caseApiUrl + '/documentation/all' + toQuery({ where: filter }),
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
    return this.http.get<FullContactDocumentation[]>(
      this.caseApiUrl + '/documentation/my' + toQuery({ where: filter }),
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
          triggerBlobDownload('doc.pdf', blob);
        },
        error: () => {},
      });
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
    return this.http.get<FullContactDocumentation>(
      this.caseApiUrl +
        '/i/' +
        caseId +
        '/documentation' +
        toQuery({ where: filter }),
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
      this.caseApiUrl +
        '/i/' +
        caseId +
        '/documentation/latest' +
        toQuery({ n }),
    );
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
    return this.http
      .post<FullContactDocumentation>(
        this.caseApiUrl + '/i/' + caseId + '/documentation',
        input,
      )
      .pipe(this.warningsService.refreshAfter());
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
    return this.http
      .put<FullContactDocumentation>(
        this.caseApiUrl + '/i/' + caseId + '/documentation/i/' + docId,
        update,
      )
      .pipe(this.warningsService.refreshAfter());
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
      .pipe(this.warningsService.refreshAfter());
  }
}
