import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import Keycloak from 'keycloak-js';

import { Families } from './family-list.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { buildUser } from 'src/app/testing/fixtures';
import { Role } from '../../../../../shared/generated/prisma/enums';

describe('Families', () => {
  let component: Families;
  let fixture: ComponentFixture<Families>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Families],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Families);
    component = fixture.componentInstance;
    // CaseService is injected as a field on the component, whose constructor fires a /settings
    // GET through SettingsService as soon as the component instance is created - independent of
    // detectChanges().
    flushSettings(httpMock);
  });

  afterEach(() => httpMock.verify());

  function flushBootstrapRequests(user = buildUser({ role: Role.User })) {
    httpMock.match((r) => r.url.endsWith('/me')).forEach((r) => r.flush(user));
    return user;
  }

  it('loads and paginates the cases for a plain user', () => {
    fixture.detectChanges();
    const user = flushBootstrapRequests();

    const casesReq = httpMock.match((r) => r.url.includes('/case'));
    expect(casesReq.length).toBe(1);
    const cases = Array.from({ length: 3 }, (_, i) => ({
      id: `case-${i}`,
      familyId: `family-${i}`,
      responsibleUsers: [{ id: user.id }],
    }));
    casesReq[0].flush(cases);

    expect(component['allCases'].length).toBe(3);
    expect(component['pagedCases'].length).toBe(3);
    expect(component['totalCount']).toBe(3);
  });

  it('only allows editing cases the user is responsible for, unless Admin', () => {
    fixture.detectChanges();
    flushBootstrapRequests();
    httpMock.match(() => true).forEach((r) => r.flush([]));

    component['currentUser'] = buildUser({ id: 'me', role: Role.User });
    const ownCase = { responsibleUsers: [{ id: 'me' }] } as any;
    const otherCase = { responsibleUsers: [{ id: 'someone-else' }] } as any;

    expect(component.canEditCase(ownCase)).toBeTrue();
    expect(component.canEditCase(otherCase)).toBeFalse();

    component['currentUser'] = buildUser({ id: 'me', role: Role.Admin });
    expect(component.canEditCase(otherCase)).toBeTrue();
  });

  it('canEditCase returns false when there is no current user or no case', () => {
    component['currentUser'] = undefined;
    expect(component.canEditCase({ responsibleUsers: [] } as any)).toBeFalse();

    component['currentUser'] = buildUser({ role: Role.Admin });
    expect(component.canEditCase(undefined)).toBeFalse();
  });

  it("scopes the query to the org for an OrgCoordinator", () => {
    fixture.detectChanges();
    flushBootstrapRequests(
      buildUser({ role: Role.OrgCoordinator, organisationId: 'org-1' }),
    );

    const casesReq = httpMock.expectOne((r) => r.url.includes('/case?'));
    expect(decodeURIComponent(casesReq.request.url)).toContain(
      '"organisation":{"id":"org-1"}',
    );
    casesReq.flush([]);
  });

  it('scopes the query to the sub-organisations for a SubOrgCoordinator', () => {
    fixture.detectChanges();
    flushBootstrapRequests(
      buildUser({
        role: Role.SubOrgCoordinator,
        subOrganisations: [{ id: 'sub-1' }, { id: 'sub-2' }],
      }),
    );

    const casesReq = httpMock.expectOne((r) => r.url.includes('/case?'));
    expect(decodeURIComponent(casesReq.request.url)).toContain(
      '"subOrganisationId":{"in":["sub-1","sub-2"]}',
    );
    casesReq.flush([]);
  });

  it('fetches every case for an Admin, with no filter', () => {
    fixture.detectChanges();
    flushBootstrapRequests(buildUser({ role: Role.Admin }));

    const casesReq = httpMock.expectOne((r) => r.url.includes('/case?'));
    expect(decodeURIComponent(casesReq.request.url)).toContain('where=');
    casesReq.flush([]);
  });

  describe('pagination', () => {
    function loadCases(count: number) {
      fixture.detectChanges();
      flushBootstrapRequests();
      const casesReq = httpMock.expectOne((r) => r.url.includes('/case?'));
      casesReq.flush(
        Array.from({ length: count }, (_, i) => ({
          id: `case-${i}`,
          familyId: `family-${i}`,
          responsibleUsers: [],
        })),
      );
    }

    it('rangeStart is 0 when there are no cases', () => {
      loadCases(0);
      expect(component['rangeStart']).toBe(0);
    });

    it('rangeStart/rangeEnd reflect the current page', () => {
      loadCases(25);
      expect(component['rangeStart']).toBe(1);
      expect(component['rangeEnd']).toBe(10);

      component['goToNextPage']();
      expect(component['rangeStart']).toBe(11);
      expect(component['rangeEnd']).toBe(20);
    });

    it('goToPreviousPage is a no-op on the first page', () => {
      loadCases(25);
      component['goToPreviousPage']();
      expect(component['currentPage']).toBe(1);
    });

    it('goToNextPage is a no-op on the last page', () => {
      loadCases(5);
      expect(component['totalPages']).toBe(1);
      component['goToNextPage']();
      expect(component['currentPage']).toBe(1);
    });

    it('goToPreviousPage steps back a page', () => {
      loadCases(25);
      component['goToNextPage']();
      component['goToPreviousPage']();
      expect(component['currentPage']).toBe(1);
    });

    it('onPageSizeChange updates the page size and resets to page 1', () => {
      loadCases(25);
      component['goToNextPage']();

      component['onPageSizeChange']({
        target: { value: '25' },
      } as unknown as Event);

      expect(component['pageSize']).toBe(25);
      expect(component['currentPage']).toBe(1);
      expect(component['pagedCases'].length).toBe(25);
    });

    it('onPageSizeChange ignores a falsy value', () => {
      loadCases(25);

      component['onPageSizeChange']({
        target: { value: '0' },
      } as unknown as Event);

      expect(component['pageSize']).toBe(10);
    });
  });

  describe('navigation', () => {
    it('edit navigates to edit-family when the user may edit the case', () => {
      fixture.detectChanges();
      const user = flushBootstrapRequests(buildUser({ id: 'me', role: Role.Admin }));
      const casesReq = httpMock.expectOne((r) => r.url.includes('/case?'));
      casesReq.flush([
        { id: 'case-1', familyId: 'family-1', responsibleUsers: [{ id: user.id }] },
      ]);
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      component.edit('family-1');

      expect(router.navigate).toHaveBeenCalledWith(['edit-family', 'family-1']);
    });

    it('edit does nothing when the user may not edit the case', () => {
      fixture.detectChanges();
      flushBootstrapRequests(buildUser({ id: 'me', role: Role.User }));
      const casesReq = httpMock.expectOne((r) => r.url.includes('/case?'));
      casesReq.flush([
        { id: 'case-1', familyId: 'family-1', responsibleUsers: [{ id: 'other' }] },
      ]);
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      component.edit('family-1');

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('inspect navigates to edit-family in read-only mode', () => {
      fixture.detectChanges();
      flushBootstrapRequests();
      httpMock.expectOne((r) => r.url.includes('/case?')).flush([]);
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      component.inspect('family-1');

      expect(router.navigate).toHaveBeenCalledWith(['edit-family', 'family-1'], {
        queryParams: { readonly: true },
      });
    });
  });

  it('getAdressString formats the address', () => {
    expect(
      component.getAdressString({
        street: 'Hauptstr.',
        number: '1',
        plz: '12345',
        city: 'Berlin',
      }),
    ).toBe('Hauptstr. 1, 12345 Berlin');
  });

  describe('detail modal', () => {
    it('openDetailModal selects the matching case and marks it read-only when not editable', () => {
      fixture.detectChanges();
      flushBootstrapRequests(buildUser({ id: 'me', role: Role.User }));
      const casesReq = httpMock.expectOne((r) => r.url.includes('/case?'));
      casesReq.flush([
        { id: 'case-1', familyId: 'family-1', responsibleUsers: [{ id: 'other' }] },
      ]);

      component.openDetailModal('case-1');

      expect(component['isDetailModalOpen']).toBeTrue();
      expect(component['selectedCase']).toEqual(
        jasmine.objectContaining({ familyId: 'family-1' }),
      );
      expect(component['modalReadOnly']).toBeTrue();
    });

    it('closeDetails closes the modal', () => {
      component['isDetailModalOpen'] = true;

      component.closeDetails();

      expect(component['isDetailModalOpen']).toBeFalse();
    });
  });
});
