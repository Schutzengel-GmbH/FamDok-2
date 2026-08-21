import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { DocumentService, triggerBlobDownload } from './document.service';
import { environment } from 'src/environments/environment';

describe('DocumentService', () => {
  let service: DocumentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DocumentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getDocuments GETs the document list with an optional filter', () => {
    service.getDocuments().subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/document'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getDocuments encodes the given filter into the where param', () => {
    service.getDocuments({ title: { contains: 'Formular' } }).subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/document'));
    expect(decodeURIComponent(req.request.url)).toContain('"title":{"contains":"Formular"}');
    req.flush([]);
  });

  it('getTags GETs the tag list', () => {
    service.getTags().subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/document/tags`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('uploadDocument POSTs a FormData payload with file, title, description, and tagIds', () => {
    const file = new File(['content'], 'test.pdf');
    service.uploadDocument(file, { title: 'Consent', description: 'A form', tagIds: ['t1'] }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/document`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('title')).toBe('Consent');
    expect(body.get('description')).toBe('A form');
    expect(body.get('tagIds')).toBe('["t1"]');
    req.flush({});
  });

  it('updateDocument PUTs the metadata with tagIds serialized', () => {
    service.updateDocument('doc-1', { title: 'Renamed', tagIds: ['t1', 't2'] }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/document/i/doc-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      title: 'Renamed',
      description: undefined,
      tagIds: '["t1","t2"]',
    });
    req.flush({});
  });

  it('updateDocument defaults tagIds to an empty array when not given', () => {
    service.updateDocument('doc-1', { title: 'Renamed' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/document/i/doc-1`);
    expect(req.request.body.tagIds).toBe('[]');
    req.flush({});
  });

  it('uploadDocument omits the description field from the FormData when not given', () => {
    const file = new File(['content'], 'test.pdf');
    service.uploadDocument(file, { title: 'Consent' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/document`);
    const body = req.request.body as FormData;
    expect(body.get('description')).toBeNull();
    req.flush({});
  });

  it('deleteDocument DELETEs by id', () => {
    service.deleteDocument('doc-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/document/i/doc-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('createTag POSTs a new tag name', () => {
    service.createTag('Formulare').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/document/tags`);
    expect(req.request.body).toEqual({ name: 'Formulare' });
    req.flush({});
  });

  it('renameTag PUTs the new tag name', () => {
    service.renameTag('tag-1', 'Neu').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/document/tags/i/tag-1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteTag DELETEs by id', () => {
    service.deleteTag('tag-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/document/tags/i/tag-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('downloadDocument fetches the file as a blob and triggers a save', () => {
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');
    spyOn(URL, 'createObjectURL').and.returnValue('blob:mock');
    spyOn(URL, 'revokeObjectURL');

    service.downloadDocument({ id: 'doc-1', filename: 'test.pdf' } as any);

    const req = httpMock.expectOne(`${environment.apiUrl}/document/i/doc-1/download`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());

    expect(clickSpy).toHaveBeenCalled();
  });
});

describe('triggerBlobDownload', () => {
  it('creates an object URL and clicks a temporary anchor to download the blob', () => {
    const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.returnValue('blob:mock');
    const revokeObjectURLSpy = spyOn(URL, 'revokeObjectURL');
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

    triggerBlobDownload('file.pdf', new Blob());

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock');
  });
});
