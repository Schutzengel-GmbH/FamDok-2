import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { MeService } from './me.service';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { buildUser } from 'src/app/testing/fixtures';
import { environment } from 'src/environments/environment';

describe('MeService', () => {
  let service: MeService;
  let httpMock: HttpTestingController;
  let keycloak: Keycloak;

  beforeEach(() => {
    keycloak = mockKeycloak({ tokenParsed: { sub: 'kc-123' } } as any);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: keycloak },
      ],
    });
    service = TestBed.inject(MeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reads the Keycloak id from the parsed token', () => {
    expect(service.getKCId()).toBe('kc-123');
  });

  it('fetches and caches the current user across subsequent calls', () => {
    const user = buildUser();
    let first: unknown;
    let second: unknown;

    service.getMe().subscribe((u) => (first = u));
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(user);
    service.getMe().subscribe((u) => (second = u));

    expect(first).toEqual(user as any);
    expect(second).toEqual(user as any);
    expect(httpMock.match(`${environment.apiUrl}/me`).length).toBe(0);
  });

  it('update PUTs the new name and refreshes the cache', () => {
    const original = buildUser({ firstName: 'Old' });
    service.getMe().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(original);

    const updated = { ...original, firstName: 'New' };
    let updateResult: unknown;
    service.update('New', original.lastName).subscribe((u) => (updateResult = u));
    const putReq = httpMock.expectOne(`${environment.apiUrl}/me`);
    expect(putReq.request.method).toBe('PUT');
    putReq.flush(updated);

    expect(updateResult).toEqual(updated as any);

    let cached: unknown;
    service.getMe().subscribe((u) => (cached = u));
    expect(cached).toEqual(updated as any);
  });
});
