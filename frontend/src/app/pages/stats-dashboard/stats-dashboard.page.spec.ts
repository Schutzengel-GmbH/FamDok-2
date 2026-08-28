import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { StatsDashboardPage } from './stats-dashboard.page';
import { environment } from 'src/environments/environment';

describe('StatsDashboardPage', () => {
  let component: StatsDashboardPage;
  let fixture: ComponentFixture<StatsDashboardPage>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem('STATS_STATE');

    TestBed.configureTestingModule({
      imports: [StatsDashboardPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StatsDashboardPage);
    component = fixture.componentInstance;
    // availableCities = toSignal(statsService.getCities()) subscribes as soon as the
    // component is constructed, independent of detectChanges().
    httpMock.expectOne(`${environment.apiUrl}/stats/cities`).flush(['Berlin']);
    // The nested app-stats-card-dynamic renders unconditionally and always fetches the
    // dynamic-form definitions eligible for the "other charts" selector.
    httpMock
      .match((r) => r.url.includes('/general-form/definitions'))
      .forEach((r) => r.flush([]));
    // The nested app-org-select also fetches the org list in its constructor, independent
    // of detectChanges().
    httpMock.expectOne(`${environment.apiUrl}/org`).flush([]);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('STATS_STATE');
  });

  describe('dateFromChange / dateToChange', () => {
    it('accepts a valid date string', () => {
      component.dateFromChange({ target: { value: '2026-01-15' } } as unknown as Event);

      expect(component.dateFrom()).toBe('2026-01-15');
    });

    it('falls back to the max date when given an invalid date', () => {
      component.dateFromChange({ target: { value: 'not-a-date' } } as unknown as Event);

      expect(component.dateFrom()).toBe('9999-12-31');
    });

    it('falls back to the max date when given a date beyond year 9999', () => {
      component.dateToChange({ target: { value: '99999-01-01' } } as unknown as Event);

      expect(component.dateTo()).toBe('9999-12-31');
    });

    it('dateToChange accepts a valid date string', () => {
      component.dateToChange({ target: { value: '2026-06-01' } } as unknown as Event);

      expect(component.dateTo()).toBe('2026-06-01');
    });
  });

  it('range reflects the start/end of the selected dates', () => {
    component.dateFromChange({ target: { value: '2026-01-15' } } as unknown as Event);
    component.dateToChange({ target: { value: '2026-01-20' } } as unknown as Event);

    const range = component.range();

    expect(range.start.getDate()).toBe(15);
    expect(range.start.getHours()).toBe(0);
    expect(range.end.getDate()).toBe(20);
    expect(range.end.getHours()).toBe(23);
  });

  describe('exportCsv', () => {
    it('builds a CSV summary and triggers a download', async () => {
      component.city.set('Berlin');
      component.plz.set('12345');
      component.dateFromChange({ target: { value: '2026-01-01' } } as unknown as Event);
      component.dateToChange({ target: { value: '2026-01-31' } } as unknown as Event);

      let capturedBlob: Blob | undefined;
      spyOn(URL, 'createObjectURL').and.callFake((blob: any) => {
        capturedBlob = blob;
        return 'blob:mock';
      });
      spyOn(URL, 'revokeObjectURL');
      const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

      component.exportCsv();

      expect(clickSpy).toHaveBeenCalled();
      const text = await capturedBlob!.text();
      expect(text).toContain('Berlin');
      expect(text).toContain('12345');
      expect(text).toContain('2026-01-01 bis 2026-01-31');
    });

    it('uses placeholder labels when no city/plz/dates are set', async () => {
      let capturedBlob: Blob | undefined;
      spyOn(URL, 'createObjectURL').and.callFake((blob: any) => {
        capturedBlob = blob;
        return 'blob:mock';
      });
      spyOn(URL, 'revokeObjectURL');
      spyOn(HTMLAnchorElement.prototype, 'click');
      component.city.set('');
      component.plz.set('');

      component.exportCsv();

      const text = await capturedBlob!.text();
      expect(text).toContain('Alle Orte');
      expect(text).toContain('Alle PLZ');
    });
  });

  describe('exportJson', () => {
    it('builds a JSON summary and triggers a download', async () => {
      component.city.set('Berlin');
      component.plz.set('12345');
      component.dateFromChange({ target: { value: '2026-01-01' } } as unknown as Event);
      component.dateToChange({ target: { value: '2026-01-31' } } as unknown as Event);

      let capturedBlob: Blob | undefined;
      spyOn(URL, 'createObjectURL').and.callFake((blob: any) => {
        capturedBlob = blob;
        return 'blob:mock';
      });
      spyOn(URL, 'revokeObjectURL');
      const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

      component.exportJson();

      expect(clickSpy).toHaveBeenCalled();
      expect(capturedBlob!.type).toContain('application/json');
      const parsed = JSON.parse(await capturedBlob!.text());
      expect(parsed).toEqual([
        {
          'Ort/Region': 'Berlin',
          PLZ: '12345',
          Zeitraum: '2026-01-01 bis 2026-01-31',
        },
      ]);
    });

    it('uses placeholder labels when no city/plz/dates are set', async () => {
      let capturedBlob: Blob | undefined;
      spyOn(URL, 'createObjectURL').and.callFake((blob: any) => {
        capturedBlob = blob;
        return 'blob:mock';
      });
      spyOn(URL, 'revokeObjectURL');
      spyOn(HTMLAnchorElement.prototype, 'click');
      component.city.set('');
      component.plz.set('');

      component.exportJson();

      const parsed = JSON.parse(await capturedBlob!.text());
      expect(parsed[0]['Ort/Region']).toBe('Alle Orte');
      expect(parsed[0]['PLZ']).toBe('Alle PLZ');
    });
  });

  describe('exportXlsx', () => {
    it('builds an xlsx summary and triggers a download', async () => {
      component.city.set('Berlin');
      component.plz.set('12345');
      component.dateFromChange({ target: { value: '2026-01-01' } } as unknown as Event);
      component.dateToChange({ target: { value: '2026-01-31' } } as unknown as Event);

      let capturedBlob: Blob | undefined;
      spyOn(URL, 'createObjectURL').and.callFake((blob: any) => {
        capturedBlob = blob;
        return 'blob:mock';
      });
      spyOn(URL, 'revokeObjectURL');
      const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');

      await component.exportXlsx();

      expect(clickSpy).toHaveBeenCalled();
      expect(capturedBlob!.size).toBeGreaterThan(0);
      expect(capturedBlob!.type).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });
  });
});
