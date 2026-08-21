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

  it('getCasesForUser scopes the filter to cases the user is responsible for', () => {
    service.getCasesForUser('user-1').subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/case?'));
    expect(decodeURIComponent(req.request.url)).toContain(
      '"responsibleUsers":{"some":{"OR":[{"id":"user-1"},{"kcId":"user-1"}]}}',
    );
    req.flush([]);
  });

  it('getMyCases defaults the scope to "own"', () => {
    service.getMyCases({}).subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/case/my'));
    expect(decodeURIComponent(req.request.url)).toContain('scope=own');
    req.flush([]);
  });

  describe('createFamily', () => {
    it('rejects when the user has no organisation', (done) => {
      service.createFamily({} as any, {} as any).subscribe({
        error: (err) => {
          expect(err.message).toContain('nicht Teil einer Organisation');
          done();
        },
      });

      httpMock.expectOne(`${environment.apiUrl}/me`).flush(buildUser({ organisationId: null }));
    });

    it('creates the family then the case, attaching the requesting user and derived city/plz', () => {
      service
        .createFamily(
          { name: 'Muster', adress: { city: 'Berlin', plz: '12345' } } as any,
          { startedAt: new Date() } as any,
        )
        .subscribe();

      const user = buildUser({ id: 'user-1', organisationId: 'org-1' });
      httpMock.expectOne(`${environment.apiUrl}/me`).flush(user);

      const familyReq = httpMock.expectOne(`${environment.apiUrl}/family`);
      expect(familyReq.request.body.organisation).toEqual({ connect: { id: 'org-1' } });
      familyReq.flush({ id: 'family-1' });

      const caseReq = httpMock.expectOne(`${environment.apiUrl}/case`);
      expect(caseReq.request.body.family).toEqual({ connect: { id: 'family-1' } });
      expect(caseReq.request.body.responsibleUsers).toEqual({ connect: { id: 'user-1' } });
      expect(caseReq.request.body.city).toBe('Berlin');
      expect(caseReq.request.body.plz).toBe('12345');
      caseReq.flush({});
    });
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
