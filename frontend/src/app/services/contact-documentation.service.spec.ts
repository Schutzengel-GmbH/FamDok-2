import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ContactDocumentationService } from './contact-documentation.service';
import { environment } from 'src/environments/environment';

describe('ContactDocumentationService', () => {
  let service: ContactDocumentationService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContactDocumentationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getDocumentations GETs all documentation', () => {
    service.getDocumentations().subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/case/documentation/all'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getMyDocumentations GETs the current user\'s documentation', () => {
    service.getMyDocumentations().subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/case/documentation/my'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getDocumentation GETs a single documentation by case and doc id', () => {
    service.getDocumentation('case-1', 'doc-1').subscribe();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getDocumentationForCase GETs documentation scoped to a case', () => {
    service.getDocumentationForCase('case-1').subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/case/i/case-1/documentation'));
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getLatestDocumentationForCase omits the n param when not given', () => {
    service.getLatestDocumentationForCase('case-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1/documentation/latest`);
    expect(req.request.params.has('n')).toBeFalse();
    req.flush([]);
  });

  it('getLatestDocumentationForCase includes n when given', () => {
    service.getLatestDocumentationForCase('case-1', 3).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/case/i/case-1/documentation/latest`,
    );
    expect(req.request.params.get('n')).toBe('3');
    req.flush([]);
  });

  it('createDocumentation POSTs the new documentation', () => {
    const input = { date: new Date() } as any;
    service.createDocumentation('case-1', input).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1/documentation`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(input);
    req.flush({});
  });

  it('updateDocumentation PUTs the update', () => {
    service.updateDocumentation('case-1', 'doc-1', {} as any).subscribe();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1`,
    );
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteDocumentation DELETEs by case and doc id', () => {
    service.deleteDocumentation('case-1', 'doc-1').subscribe();

    const req = httpMock.expectOne(
      `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('downloadContactDocumentationPDF fetches the PDF as a blob and triggers a save', () => {
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');
    spyOn(URL, 'createObjectURL').and.returnValue('blob:mock');
    spyOn(URL, 'revokeObjectURL');

    service.downloadContactDocumentationPDF('case-1', 'doc-1');

    const req = httpMock.expectOne(
      `${environment.apiUrl}/case/i/case-1/documentation/i/doc-1/download`,
    );
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());

    expect(clickSpy).toHaveBeenCalled();
  });
});
