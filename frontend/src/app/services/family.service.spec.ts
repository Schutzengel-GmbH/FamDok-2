import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { FamilyService } from './family.service';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { environment } from 'src/environments/environment';
import { Status } from '../../../../shared/generated/prisma/enums';

describe('FamilyService', () => {
  let service: FamilyService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });
    service = TestBed.inject(FamilyService);
    httpMock = TestBed.inject(HttpTestingController);
    flushSettings(httpMock);
  });

  afterEach(() => httpMock.verify());

  it('getFamilies GETs families with an optional filter', () => {
    service.getFamilies().subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/family') && !r.url.includes('/i/'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getFamilies encodes the given filter into the where param', () => {
    service.getFamilies({ name: { equals: 'Muster' } }).subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/family') && !r.url.includes('/i/'));
    expect(decodeURIComponent(req.request.url)).toContain('"name":{"equals":"Muster"}');
    req.flush([]);
  });

  it('getFamily GETs a single family by id', () => {
    service.getFamily('family-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/family/i/family-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getHealthData extracts the healthData field from the child', () => {
    let result: unknown;
    service.getHealthData('family-1', 'child-1').subscribe((r) => (result = r));

    const healthData = [{ date: new Date(), weightKg: 5 }];
    httpMock
      .expectOne(`${environment.apiUrl}/family/i/family-1/children/child-1`)
      .flush({ id: 'child-1', healthData });

    expect(result).toEqual(healthData as any);
  });

  it('updateFamily PUTs the update', () => {
    service.updateFamily('family-1', { name: 'Neu' } as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/family/i/family-1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteFamily DELETEs by id', () => {
    service.deleteFamily('family-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/family/i/family-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('createCaseFormResponse POSTs the new response', () => {
    service.createCaseFormResponse({} as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case-form-response`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateCaseFormResponse PUTs the update', () => {
    service.updateCaseFormResponse('resp-1', {} as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case-form-response/i/resp-1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteCaseFormResponse DELETEs by id', () => {
    service.deleteCaseFormResponse('resp-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case-form-response/i/resp-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('addZiel POSTs the new zielvereinbarung', () => {
    service.addZiel('case-1', {} as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1/ziel`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateZiel PUTs the update', () => {
    service.updateZiel('case-1', 'ziel-1', {} as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1/ziel/ziel-1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteZiel DELETEs the zielvereinbarung', () => {
    service.deleteZiel('case-1', 'ziel-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1/ziel/ziel-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('getDocumentations GETs all documentation', () => {
    service.getDocumentations().subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/case/documentation/all'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getDocumentations encodes the given filter into the where param', () => {
    service.getDocumentations({ caseId: 'case-1' }).subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/case/documentation/all'));
    expect(decodeURIComponent(req.request.url)).toContain('"caseId":"case-1"');
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

    const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1/documentation/i/doc-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getDocumentationForCase GETs documentation scoped to a case', () => {
    service.getDocumentationForCase('case-1').subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/case/i/case-1/documentation'));
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getDocumentationForCase encodes the given filter into the where param', () => {
    service.getDocumentationForCase('case-1', { id: 'doc-1' }).subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/case/i/case-1/documentation'));
    expect(decodeURIComponent(req.request.url)).toContain('"id":"doc-1"');
    req.flush({});
  });

  it('getLatestDocumentationForCase includes n only when given', () => {
    service.getLatestDocumentationForCase('case-1', 2).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/case/i/case-1/documentation/latest`,
    );
    expect(req.request.params.get('n')).toBe('2');
    req.flush([]);
  });

  it('getLatestDocumentationForCase omits params entirely when n is not given', () => {
    service.getLatestDocumentationForCase('case-1').subscribe();

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/case/i/case-1/documentation/latest`,
    );
    expect(req.request.params.has('n')).toBeFalse();
    req.flush([]);
  });

  it('createDocumentation POSTs the new documentation', () => {
    service.createDocumentation('case-1', {} as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1/documentation`);
    expect(req.request.method).toBe('POST');
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

  it('closeCase POSTs the closing date', () => {
    const date = new Date('2026-03-01');
    service.closeCase('case-1', date).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case/close/case-1`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ date });
    req.flush({});
  });

  it('getHandovers GETs the handover list', () => {
    service.getHandovers('case-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case/handover/case-1`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('handover POSTs the handover', () => {
    service.handover({} as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case/handover`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  describe('filterInProgress / filterNotInProgress', () => {
    it('filterInProgress is true when at least one ziel is inProgress', () => {
      const c = { zielvereinbarungen: [{ status: Status.inProgress }] } as any;

      expect(service.filterInProgress(c)).toBeTrue();
    });

    it('filterNotInProgress is true when none are inProgress', () => {
      const c = { zielvereinbarungen: [{ status: Status.done }] } as any;

      expect(service.filterNotInProgress(c)).toBeTrue();
    });
  });
});
