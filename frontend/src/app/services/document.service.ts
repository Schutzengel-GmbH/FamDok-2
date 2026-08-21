import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { FullDocument, FullTag } from '../../../../shared/types';
import { DocumentWhereInput } from '../../../../shared/generated/prisma/models';

export interface DocumentMetaInput {
  title: string;
  description?: string;
  tagIds?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class DocumentService {
  private http = inject(HttpClient);

  protected apiUrl = environment.apiUrl + '/document';

  /**
   * Fetches documents from the library.
   * @param {DocumentWhereInput} [filter] Optional Prisma where filter
   * @returns {Observable<FullDocument[]>} Observable emitting an array of documents
   */
  getDocuments(filter?: DocumentWhereInput): Observable<FullDocument[]> {
    const params = new URLSearchParams({
      where: filter ? JSON.stringify(filter) : '',
    });
    return this.http.get<FullDocument[]>(this.apiUrl + '?' + params.toString());
  }

  /**
   * Fetches all admin-managed tags.
   * @returns {Observable<FullTag[]>} Observable emitting the tag list
   */
  getTags(): Observable<FullTag[]> {
    return this.http.get<FullTag[]>(this.apiUrl + '/tags');
  }

  /**
   * Uploads a new document to the library. Admin only.
   * @param {File} file The file to upload
   * @param {DocumentMetaInput} meta Title/description/tag metadata
   * @returns {Observable<FullDocument>} Observable emitting the created document
   */
  uploadDocument(file: File, meta: DocumentMetaInput): Observable<FullDocument> {
    return this.http.post<FullDocument>(
      this.apiUrl,
      this.toFormData(file, meta),
    );
  }

  /**
   * Updates a document's metadata (title/description/tags). Admin only.
   * @param {string} id UUID of the document
   * @param {Omit<DocumentMetaInput, never>} meta Updated metadata
   * @returns {Observable<FullDocument>} Observable emitting the updated document
   */
  updateDocument(
    id: string,
    meta: DocumentMetaInput,
  ): Observable<FullDocument> {
    return this.http.put<FullDocument>(this.apiUrl + '/i/' + id, {
      title: meta.title,
      description: meta.description,
      tagIds: JSON.stringify(meta.tagIds ?? []),
    });
  }

  /**
   * Deletes a document from the library. Admin only.
   * @param {string} id UUID of the document
   * @returns {Observable<FullDocument>} Observable emitting the deleted document
   */
  deleteDocument(id: string): Observable<FullDocument> {
    return this.http.delete<FullDocument>(this.apiUrl + '/i/' + id);
  }

  /** Downloads a document and triggers a browser save-as for it. */
  downloadDocument(doc: FullDocument): void {
    this.http
      .get(this.apiUrl + '/i/' + doc.id + '/download', { responseType: 'blob' })
      .subscribe((blob) => triggerBlobDownload(doc.filename, blob));
  }

  createTag(name: string): Observable<FullTag> {
    return this.http.post<FullTag>(this.apiUrl + '/tags', { name });
  }

  renameTag(id: string, name: string): Observable<FullTag> {
    return this.http.put<FullTag>(this.apiUrl + '/tags/i/' + id, { name });
  }

  deleteTag(id: string): Observable<FullTag> {
    return this.http.delete<FullTag>(this.apiUrl + '/tags/i/' + id);
  }

  private toFormData(file: File, meta: DocumentMetaInput): FormData {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', meta.title);
    if (meta.description) formData.append('description', meta.description);
    formData.append('tagIds', JSON.stringify(meta.tagIds ?? []));
    return formData;
  }
}

/** Triggers a browser download of `blob` as `filename`. */
export function triggerBlobDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
