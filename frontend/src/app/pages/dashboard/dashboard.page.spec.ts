import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { DashboardPage } from './dashboard.page';
import { DashboardCasesService } from 'src/app/services/dashboard-cases.service';
import { DashboardFamilyTableComponent } from 'src/app/components/dashboard-family-table/dashboard-family-table.component';
import { WarningsListComponent } from 'src/app/components/warnings-list/warnings-list.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { buildUser } from 'src/app/testing/fixtures';
import { environment } from 'src/environments/environment';
import { Role } from '../../../../../shared/generated/prisma/enums';

describe('DashboardPage', () => {
  let component: DashboardPage;
  let fixture: ComponentFixture<DashboardPage>;
  let httpMock: HttpTestingController;
  let dashboardCases: DashboardCasesService;

  function setup() {
    TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPage);
    component = fixture.componentInstance;
    dashboardCases = TestBed.inject(DashboardCasesService);

    // DashboardCasesService.getMe() fires as soon as the service is constructed
    // (a field on the page), independent of detectChanges().
    httpMock
      .expectOne(`${environment.apiUrl}/me`)
      .flush(buildUser({ role: Role.User, id: 'me' }));
    // CaseService is also injected on the page (via DashboardCasesService), whose constructor
    // fires a /settings GET through SettingsService regardless of detectChanges().
    flushSettings(httpMock);
  }

  afterEach(() => httpMock.verify());

  it('myCases reflects the shared DashboardCasesService cases signal', () => {
    setup();
    const cases = [{ id: 'c1' }, { id: 'c2' }] as any;

    dashboardCases.cases.set(cases);

    expect(component.myCases).toEqual(cases);
  });

  describe('onOpenZielvereinbarung', () => {
    it('delegates to the family table view child', () => {
      setup();
      component.familyTable = jasmine.createSpyObj('DashboardFamilyTableComponent', [
        'openCaseById',
      ]) as unknown as DashboardFamilyTableComponent;

      component.onOpenZielvereinbarung('case-1');

      expect(component.familyTable.openCaseById).toHaveBeenCalledWith(
        'case-1',
        'zielvereinbarungen',
      );
    });

    it('is a no-op when the family table has not rendered yet', () => {
      setup();
      component.familyTable = undefined as any;

      expect(() => component.onOpenZielvereinbarung('case-1')).not.toThrow();
    });
  });

  describe('onDetailsClosed', () => {
    it('reloads the shared cases and refreshes the warnings list', () => {
      setup();
      spyOn(dashboardCases, 'reload');
      component.warningsList = jasmine.createSpyObj('WarningsListComponent', [
        'refresh',
      ]) as unknown as WarningsListComponent;

      component.onDetailsClosed();

      expect(dashboardCases.reload).toHaveBeenCalled();
      expect(component.warningsList.refresh).toHaveBeenCalled();
    });

    it('does not throw when the warnings list has not rendered yet', () => {
      setup();
      spyOn(dashboardCases, 'reload');
      component.warningsList = undefined as any;

      expect(() => component.onDetailsClosed()).not.toThrow();
      expect(dashboardCases.reload).toHaveBeenCalled();
    });
  });
});
