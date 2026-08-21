import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { UserService } from './user.service';
import { environment } from 'src/environments/environment';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getAllUsers GETs the user list with an optional filter', () => {
    service.getAllUsers({ role: 'Admin' } as any).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url.includes('/user') && decodeURIComponent(r.urlWithParams).includes('where={"role":"Admin"}'),
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getOrgUsers GETs users scoped to an organisation', () => {
    service.getOrgUsers('org-1').subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/user/org/org-1'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('createUser POSTs the new user', () => {
    const user = { email: 'a@b.de' } as any;
    service.createUser(user).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/user`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(user);
    req.flush({});
  });

  it('updateUser PUTs the update by id', () => {
    service.updateUser('user-1', { firstName: 'New' } as any).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/user/i/user-1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('getUser GETs by id', () => {
    service.getUser('user-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/user/i/user-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('deleteUser DELETEs by id', () => {
    service.deleteUser('user-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/user/i/user-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
