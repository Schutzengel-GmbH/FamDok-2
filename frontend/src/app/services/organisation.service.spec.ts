import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { OrgService } from './organisation.service';
import { environment } from 'src/environments/environment';

describe('OrgService', () => {
  let service: OrgService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OrgService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getAll GETs all organisations', () => {
    service.getAll().subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/org`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('get GETs a single organisation by id', () => {
    service.get('org-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/org/i/org-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('create POSTs a new organisation', () => {
    const data = { name: 'Neu' } as any;
    service.create(data).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/org`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(data);
    req.flush({});
  });

  it('update PUTs the organisation update', () => {
    service.update('org-1', { name: 'Neu' } as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/org/i/org-1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('delete DELETEs the organisation', () => {
    service.delete('org-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/org/i/org-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('addUser connects the user to the organisation via UserService', () => {
    service.addUser('user-1', 'org-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/user/i/user-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ organisation: { connect: { id: 'org-1' } } });
    req.flush({});
  });
});
