import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import Keycloak from 'keycloak-js';

import { TabZielvereinbarungenComponent } from './tab-zielvereinbarungen.component';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { flushSettings } from 'src/app/testing/http-helpers';
import { environment } from 'src/environments/environment';
import { WarningType } from '../../../../../../shared/consts';
import { Status } from '../../../../../../shared/generated/prisma/enums';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

describe('TabZielvereinbarungenComponent', () => {
  let component: TabZielvereinbarungenComponent;
  let fixture: ComponentFixture<TabZielvereinbarungenComponent>;
  let httpMock: HttpTestingController;

  const ziel = {
    id: 'ziel-1',
    topic: 'Wohnen',
    description: 'desc',
    status: Status.inProgress,
    startedAt: new Date('2026-01-01'),
    finishBy: new Date('2026-06-01'),
  };

  function setup(warnings: unknown[] = []) {
    TestBed.configureTestingModule({
      imports: [TabZielvereinbarungenComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Keycloak, useValue: mockKeycloak() },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TabZielvereinbarungenComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('selectedCase', {
      id: 'case-1',
      zielvereinbarungen: [ziel],
    } as any);
    fixture.detectChanges();

    flushSettings(httpMock);
    httpMock.expectOne((r) => r.url.includes('/warnings')).flush(warnings);
  }

  afterEach(() => httpMock.verify());

  it('seeds ziele from the selected case', () => {
    setup();

    expect(component['ziele']()).toEqual([ziel] as any);
  });

  describe('openZielFormNew / openZielFormEdit / cancelZielForm', () => {
    it('opens a fresh, in-progress ziel form', () => {
      setup();

      component.openZielFormNew();

      expect(component['zielFormOpen']()).toBeTrue();
      expect(component['currentZiel']().status).toBe(Status.inProgress);
      expect(component['currentZiel']().id).toBeUndefined();
    });

    it('opens an existing ziel for editing', () => {
      setup();

      component.openZielFormEdit('ziel-1');

      expect(component['currentZiel']()).toEqual(ziel as any);
    });

    it('throws when editing a ziel that does not exist', () => {
      setup();

      expect(() => component.openZielFormEdit('missing')).toThrowError(
        'Keine Zielvereinbarung gefunden',
      );
    });

    it('cancelZielForm resets the form and closes it', () => {
      setup();
      component.openZielFormEdit('ziel-1');

      component.cancelZielForm();

      expect(component['zielFormOpen']()).toBeFalse();
      expect(component['currentZiel']().id).toBeUndefined();
    });
  });

  describe('zielErrors / currentZielValid', () => {
    it('flags all required fields as missing on an empty ziel', () => {
      setup();
      component['currentZiel'].set({});

      const errors = component.zielErrors();

      expect(errors.startedAt).toBeTrue();
      expect(errors.finishBy).toBeTrue();
      expect(errors.topic).toBeTrue();
      expect(errors.status).toBeTrue();
      expect(errors.description).toBeTrue();
      expect(component.currentZielValid()).toBeFalse();
    });

    it('flags isAfter when finishBy is not after startedAt', () => {
      setup();
      component['currentZiel'].set({
        ...ziel,
        startedAt: new Date('2026-06-01'),
        finishBy: new Date('2026-01-01'),
      });

      expect(component.zielErrors().isAfter).toBeTrue();
      expect(component.currentZielValid()).toBeFalse();
    });

    it('is valid when every field is present and dates are ordered correctly', () => {
      setup();
      component['currentZiel'].set(ziel as any);

      expect(component.currentZielValid()).toBeTrue();
    });
  });

  it('changeZiel updates a single field', () => {
    setup();
    component['currentZiel'].set({});

    component.changeZiel('topic', 'Neues Thema');

    expect(component['currentZiel']().topic).toBe('Neues Thema');
  });

  describe('saveZiel', () => {
    it('shows a toast instead of saving when the form is invalid', () => {
      setup();
      component['currentZiel'].set({});

      component.saveZiel();

      expect(httpMock.match((r) => r.url.includes('/ziel')).length).toBe(0);
    });

    it('creates a new ziel via addZiel when there is no id', () => {
      setup();
      component['currentZiel'].set({ ...ziel, id: undefined });
      let emitted = false;
      component.zielChange.subscribe(() => (emitted = true));

      component.saveZiel();

      const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1/ziel`);
      expect(req.request.method).toBe('POST');
      req.flush({});

      expect(component['zielFormOpen']()).toBeFalse();
      expect(emitted).toBeTrue();
    });

    it('updates an existing ziel via updateZiel when an id is present', () => {
      setup();
      component['currentZiel'].set(ziel as any);

      component.saveZiel();

      const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1/ziel/ziel-1`);
      expect(req.request.method).toBe('PUT');
      req.flush({});
    });
  });

  describe('deleteZiel', () => {
    it('opens a confirm dialog, and confirming it deletes the ziel', () => {
      setup();
      const dialogService = TestBed.inject(ConfirmDialogService);
      let emitted = false;
      component.zielChange.subscribe(() => (emitted = true));

      component.deleteZiel('ziel-1');

      expect(dialogService.openDialogs().length).toBe(1);
      dialogService.openDialogs()[0].confirmAction();

      const req = httpMock.expectOne(`${environment.apiUrl}/case/i/case-1/ziel/ziel-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});

      expect(emitted).toBeTrue();
    });
  });

  describe('status styling helpers', () => {
    it('zielDotClass/zielBadgeClass/zielBadgeText map each status', () => {
      setup();

      expect(component.zielDotClass(Status.inProgress)).toContain('yellow');
      expect(component.zielDotClass(Status.done)).toContain('green');
      expect(component.zielDotClass(Status.failed)).toContain('red');
      expect(component.zielDotClass(undefined)).toBe('status-dot');

      expect(component.zielBadgeText(Status.inProgress)).toBe('In Arbeit');
      expect(component.zielBadgeText(Status.done)).toBe('Ziel erreicht');
      expect(component.zielBadgeText(Status.failed)).toBe('Ziel nicht erreicht');
      expect(component.zielBadgeText(undefined)).toBe('Unbekannt');
    });
  });

  describe('zielWarningTooltip', () => {
    it('is undefined when there is no matching warning', () => {
      setup();

      expect(component.zielWarningTooltip('ziel-1')).toBeUndefined();
    });

    it('describes an expired ziel', () => {
      setup([
        {
          type: WarningType.ZV_EXPIRED,
          data: { caseId: 'case-1', zielvereinbarungsId: 'ziel-1', finishBy: new Date('2026-01-01') },
        },
      ]);

      expect(component.zielWarningTooltip('ziel-1')).toContain('abgelaufen');
    });

    it('describes a soon-expiring ziel', () => {
      setup([
        {
          type: WarningType.ZV_EXPIRING_SOON,
          data: { caseId: 'case-1', zielvereinbarungsId: 'ziel-1', finishBy: new Date('2026-06-01') },
        },
      ]);

      expect(component.zielWarningTooltip('ziel-1')).toContain('läuft bald ab');
    });
  });
});
