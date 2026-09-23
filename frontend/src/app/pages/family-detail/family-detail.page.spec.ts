import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { FamilyDetailPage } from './family-detail.page';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { buildUser } from 'src/app/testing/fixtures';
import { ToastService } from 'src/app/services/toast.service';
import { environment } from 'src/environments/environment';
import { Role } from '../../../../../shared/generated/prisma/enums';

describe('FamilyDetailPage', () => {
  let component: FamilyDetailPage;
  let fixture: ComponentFixture<FamilyDetailPage>;
  let httpMock: HttpTestingController;

  const baseCase = {
    id: 'case-1',
    family: { children: [], caregiver: [] },
    responsibleUsers: [{ id: 'me' }],
    contactDocumentation: [],
    zielvereinbarungen: [],
  };

  function setup(params: Record<string, string>) {
    TestBed.configureTestingModule({
      imports: [FamilyDetailPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(params) } },
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FamilyDetailPage);
    component = fixture.componentInstance;
    flushSettings(httpMock);
  }

  afterEach(() => httpMock.verify());

  it('reads the case id from the route and loads the case', () => {
    setup({ caseId: 'case-1' });

    httpMock.expectOne(`${environment.apiUrl}/me`).flush(buildUser({ id: 'me', role: Role.User }));
    httpMock.expectOne(`${environment.apiUrl}/case/i/case-1`).flush(baseCase as any);

    expect(component.caseId).toBe('case-1');
    expect(component.selectedCase()).toEqual(baseCase as any);
    expect(component.isLoading()).toBeFalse();
  });

  it('has no initial tab when the route carries none', () => {
    setup({ caseId: 'case-1' });
    httpMock.match(() => true).forEach((r) => r.flush(r.request.url.endsWith('/me') ? buildUser() : baseCase));

    expect(component.initialTab).toBeUndefined();
  });

  it('picks up a valid tab from the route', () => {
    setup({ caseId: 'case-1', tab: 'zielvereinbarungen' });
    httpMock.match(() => true).forEach((r) => r.flush(r.request.url.endsWith('/me') ? buildUser() : baseCase));

    expect(component.initialTab).toBe('zielvereinbarungen');
  });

  it('ignores an invalid tab from the route', () => {
    setup({ caseId: 'case-1', tab: 'not-a-real-tab' });
    httpMock.match(() => true).forEach((r) => r.flush(r.request.url.endsWith('/me') ? buildUser() : baseCase));

    expect(component.initialTab).toBeUndefined();
  });

  it('readOnly reflects whether the current user is one of the case responsibleUsers', () => {
    setup({ caseId: 'case-1' });
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(buildUser({ id: 'someone-else', role: Role.User }));
    httpMock.expectOne(`${environment.apiUrl}/case/i/case-1`).flush(baseCase as any);

    expect(component.readOnly()).toBeTrue();
  });

  it('readOnly is false for the responsible user', () => {
    setup({ caseId: 'case-1' });
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(buildUser({ id: 'me', role: Role.User }));
    httpMock.expectOne(`${environment.apiUrl}/case/i/case-1`).flush(baseCase as any);

    expect(component.readOnly()).toBeFalse();
  });

  it('shows an error toast and stops loading when the case fails to load', () => {
    setup({ caseId: 'case-1' });
    const toast = TestBed.inject(ToastService);
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(buildUser());
    httpMock
      .expectOne(`${environment.apiUrl}/case/i/case-1`)
      .flush('Boom', { status: 404, statusText: 'Not Found' });

    expect(component.isLoading()).toBeFalse();
    expect(component.selectedCase()).toBeUndefined();
    expect(toast.toasts()[0].severity).toBe('danger');
  });
});
