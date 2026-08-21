import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ContactDocumentationWhereInput,
  ContactDocumentationCreateInput,
  ContactDocumentationUpdateInput,
} from '../../../../shared/generated/prisma/models';
import { FullContactDocumentation } from '../../../../shared/types';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ContactDocumentationService {
  private http = inject(HttpClient);

  protected caseApiUrl = environment.apiUrl + '/case';

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
}
