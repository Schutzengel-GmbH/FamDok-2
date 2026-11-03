import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { CaseService } from './case.service';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { buildUser } from 'src/app/testing/fixtures';
import { environment } from 'src/environments/environment';
import { Status } from '../../../../shared/generated/prisma/enums';

describe('CaseService', () => {
  let service: CaseService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });
    service = TestBed.inject(CaseService);
    httpMock = TestBed.inject(HttpTestingController);
    flushSettings(httpMock);
  });

  afterEach(() => httpMock.verify());

  it('getCases GETs cases with an optional filter', () => {
    service.getCases().subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/case') && !r.url.includes('/i/'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getCase GETs a single case by id', () => {
    service.getCase('case-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getMyCases sends the query', () => {
    service.getMyCases({ scope: 'own' }).subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/case/my'));
    expect(decodeURIComponent(req.request.url)).toContain('"scope":"own"');
    req.flush([]);
  });

  it('createCase POSTs the case together with its family', () => {
    const request = {
      startedAt: new Date(),
      family: { name: 'Muster', adress: { city: 'Berlin', plz: '12345' } },
    };

    service.createCase(request).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
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

  it('getAttachments GETs the attachment list', () => {
    service.getAttachments('case-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1/attachment`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('uploadAttachment POSTs a FormData payload with the file and optional note', () => {
    const file = new File(['x'], 'scan.pdf');
    service.uploadAttachment('case-1', file, 'a note').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1/attachment`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('note')).toBe('a note');
    req.flush({});
  });

  it('deleteAttachment DELETEs the attachment', () => {
    service.deleteAttachment('case-1', 'att-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1/attachment/i/att-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('downloadAttachment fetches the file as a blob and triggers a save', () => {
    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');
    spyOn(URL, 'createObjectURL').and.returnValue('blob:mock');
    spyOn(URL, 'revokeObjectURL');

    service.downloadAttachment('case-1', { id: 'att-1', filename: 'scan.pdf' } as any);

    const req = httpMock.expectOne(
      `${environment.apiUrl}/case/i/case-1/attachment/i/att-1/download`,
    );
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());

    expect(clickSpy).toHaveBeenCalled();
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
