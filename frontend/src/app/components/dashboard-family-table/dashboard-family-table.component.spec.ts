import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import Keycloak from 'keycloak-js';

import { DashboardFamilyTableComponent } from './dashboard-family-table.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { buildUser } from 'src/app/testing/fixtures';
import { environment } from 'src/environments/environment';
import { Role } from '../../../../../shared/generated/prisma/enums';

describe('DashboardFamilyTableComponent', () => {
  let component: DashboardFamilyTableComponent;
  let fixture: ComponentFixture<DashboardFamilyTableComponent>;
  let httpMock: HttpTestingController;

  function buildCase(overrides: Record<string, any> = {}) {
    return {
      id: 'case-1',
      family: { id: 'fam-1', name: 'Muster', note: null, children: [] },
      responsibleUsers: [],
      contactDocumentation: [],
      zielvereinbarungen: [],
      ...overrides,
    };
  }

  function setup(role: Role = Role.User) {
    TestBed.configureTestingModule({
      imports: [DashboardFamilyTableComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardFamilyTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    flushSettings(httpMock);
    const user = buildUser({ role, id: 'me' });
    httpMock.expectOne(`${environment.apiUrl}/me`).flush(user);
    return user;
  }

  function flushCases(cases: any[]) {
    httpMock.expectOne((r) => r.url.includes('/case/my')).flush(cases);
  }

  afterEach(() => httpMock.verify());

  describe('rows (filterTerm)', () => {
    it('returns every case when there is no filter term', () => {
      setup();
      const cases = [buildCase({ id: 'c1' }), buildCase({ id: 'c2' })];
      flushCases(cases);

      expect(component['rows']().map((r: any) => r.id)).toEqual(['c1', 'c2']);
    });

    it('filters case-insensitively by family name or note', () => {
      setup();
      fixture.componentRef.setInput('filterTerm', 'ber');
      const cases = [
        buildCase({ id: 'c1', family: { name: 'Berger', note: null, children: [] } }),
        buildCase({
          id: 'c2',
          family: { name: 'Schulz', note: 'Hat Berge bestiegen', children: [] },
        }),
        buildCase({ id: 'c3', family: { name: 'Meyer', note: null, children: [] } }),
      ];
      flushCases(cases);

      expect(component['rows']().map((r: any) => r.id)).toEqual(['c1', 'c2']);
    });
  });

  describe('canEditCase', () => {
    it('is always true for Admin', () => {
      setup(Role.Admin);
      flushCases([]);

      expect(
        component.canEditCase(buildCase({ responsibleUsers: [{ id: 'other' }] }) as any),
      ).toBeTrue();
    });

    it('is true only when the current user is one of the responsibleUsers otherwise', () => {
      setup(Role.User);
      flushCases([]);

      expect(
        component.canEditCase(buildCase({ responsibleUsers: [{ id: 'me' }] }) as any),
      ).toBeTrue();
      expect(
        component.canEditCase(buildCase({ responsibleUsers: [{ id: 'other' }] }) as any),
      ).toBeFalse();
    });
  });

  describe('selectCase / openDetails / openCaseById', () => {
    it('selectCase sets the selected case and emits changeSelectedCase', () => {
      setup();
      flushCases([]);
      const row = buildCase();
      let emitted: any;
      component.changeSelectedCase.subscribe((c) => (emitted = c));

      component.selectCase(row as any);

      expect(component['selectedCase']).toBe(row as any);
      expect(emitted).toBe(row as any);
    });

    it('openDetails selects the case and navigates to its detail page on the given tab', () => {
      setup(Role.User);
      flushCases([]);
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      const row = buildCase({ id: 'c1', responsibleUsers: [{ id: 'other' }] });

      component.openDetails(row as any, 'zielvereinbarungen');

      expect(component['selectedCase']).toBe(row as any);
      expect(router.navigate).toHaveBeenCalledWith([
        '/familien',
        'c1',
        'zielvereinbarungen',
      ]);
    });

    it('openDetails defaults to the stammdaten tab', () => {
      setup(Role.User);
      flushCases([]);
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      const row = buildCase({ id: 'c1', responsibleUsers: [{ id: 'me' }] });

      component.openDetails(row as any);

      expect(router.navigate).toHaveBeenCalledWith([
        '/familien',
        'c1',
        'stammdaten',
      ]);
    });

    it('openCaseById navigates to the detail page by id, without requiring the case to be loaded', () => {
      setup();
      flushCases([]);
      const router = TestBed.inject(Router);
      spyOn(router, 'navigate');

      component.openCaseById('c2', 'formulare');

      expect(router.navigate).toHaveBeenCalledWith([
        '/familien',
        'c2',
        'formulare',
      ]);
    });
  });

  describe('Zielvereinbarung status aggregation', () => {
    it('is gray with no zielvereinbarungen', () => {
      setup();
      flushCases([]);
      const row = buildCase({ zielvereinbarungen: [] });

      expect(component.getZielStatusClass(row as any)).toBe('');
      expect(component.getZielStatusText(row as any)).toBe('Keine Zielvereinbarung');
    });

    it('is green when every zielvereinbarung is done', () => {
      setup();
      flushCases([]);
      const row = buildCase({
        zielvereinbarungen: [{ status: 'done' }, { status: 'done' }],
      });

      expect(component.getZielStatusClass(row as any)).toBe('status-dot--green');
      expect(component.getZielStatusText(row as any)).toBe('Abgeschlossen');
    });

    it('is red when every zielvereinbarung failed', () => {
      setup();
      flushCases([]);
      const row = buildCase({ zielvereinbarungen: [{ status: 'failed' }] });

      expect(component.getZielStatusClass(row as any)).toBe('status-dot--red');
      expect(component.getZielStatusText(row as any)).toBe('Handlungsbedarf');
    });

    it('is yellow when at least one zielvereinbarung is in progress', () => {
      setup();
      flushCases([]);
      const row = buildCase({
        zielvereinbarungen: [{ status: 'done' }, { status: 'inProgress' }],
      });

      expect(component.getZielStatusClass(row as any)).toBe('status-dot--yellow');
      expect(component.getZielStatusText(row as any)).toBe('In Arbeit');
    });

    it('is red for a mix of done and failed with no in-progress item', () => {
      setup();
      flushCases([]);
      const row = buildCase({
        zielvereinbarungen: [{ status: 'done' }, { status: 'failed' }],
      });

      expect(component.getZielStatusClass(row as any)).toBe('status-dot--red');
      expect(component.getZielStatusText(row as any)).toBe('Handlungsbedarf');
    });
  });

  describe('getLatestContactText', () => {
    it("returns a placeholder when there's no contact documentation", () => {
      setup();
      flushCases([]);
      expect(
        component.getLatestContactText(buildCase({ contactDocumentation: [] }) as any),
      ).toBe('Kein Kontakt dokumentiert');
    });

    it('returns a placeholder when the latest entry has no date', () => {
      setup();
      flushCases([]);
      expect(
        component.getLatestContactText(
          buildCase({ contactDocumentation: [{ date: null }] }) as any,
        ),
      ).toBe('Datum unbekannt');
    });

    it('formats the latest contact date', () => {
      setup();
      flushCases([]);
      const date = new Date('2026-03-05');
      expect(
        component.getLatestContactText(
          buildCase({ contactDocumentation: [{ date }] }) as any,
        ),
      ).toBe(date.toLocaleDateString('de-DE'));
    });
  });

  describe('getChildrenCount', () => {
    it('counts the children on the family', () => {
      setup();
      flushCases([]);
      const row = buildCase({ family: { name: 'X', children: [{}, {}] } });
      expect(component.getChildrenCount(row as any)).toBe(2);
    });

    it('is 0 when the family or its children are missing', () => {
      setup();
      flushCases([]);
      expect(component.getChildrenCount(buildCase({ family: {} }) as any)).toBe(0);
    });
  });
});
