import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { DashboardCasesService } from './dashboard-cases.service';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { environment } from 'src/environments/environment';
import { Role } from '../../../../shared/generated/prisma/enums';

describe('DashboardCasesService', () => {
  let service: DashboardCasesService;
  let httpMock: HttpTestingController;

  function setup(role: Role) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DashboardCasesService);
    flushSettings(httpMock);
    httpMock.expectOne(`${environment.apiUrl}/me`).flush({ role });
  }

  afterEach(() => httpMock.verify());

  it('only offers "own" for a plain user', () => {
    setup(Role.User);

    expect(service.availableScopes()).toEqual(['own']);
  });

  it('offers org scope for an OrgCoordinator', () => {
    setup(Role.OrgCoordinator);

    expect(service.availableScopes()).toEqual(['own', 'org']);
  });

  it('offers subOrg scope for a SubOrgCoordinator', () => {
    setup(Role.SubOrgCoordinator);

    expect(service.availableScopes()).toEqual(['own', 'subOrg']);
  });

  it('reload populates cases from the API', () => {
    setup(Role.User);

    service.reload();
    const cases = [{ id: 'case-1' }];
    httpMock.expectOne((r) => r.url.includes('/case/my')).flush(cases);

    expect(service.cases()).toEqual(cases as any);
  });

  it('reload clears cases and does not throw on error', () => {
    setup(Role.User);
    spyOn(console, 'error');

    service.reload();
    httpMock
      .expectOne((r) => r.url.includes('/case/my'))
      .flush('error', { status: 500, statusText: 'Server Error' });

    expect(service.cases()).toEqual([]);
  });

  it('setScope switches the scope and reloads, but is a no-op when unchanged', () => {
    setup(Role.OrgCoordinator);

    service.setScope('org');
    httpMock.expectOne((r) => r.url.includes('/case/my') && r.url.includes('scope=org')).flush([]);
    expect(service.scope()).toBe('org');

    service.setScope('org');
    expect(httpMock.match((r) => r.url.includes('/case/my')).length).toBe(0);
  });
});
