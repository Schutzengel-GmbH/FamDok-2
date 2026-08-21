import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ChartsService } from './chart.service';
import { environment } from 'src/environments/environment';

describe('ChartsService', () => {
  let service: ChartsService;
  let httpMock: HttpTestingController;
  const range = { start: new Date('2026-01-01'), end: new Date('2026-02-01') };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChartsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('artDerBeratung tallies contacts into a 7-slot array by artDerBetreuung id', () => {
    let data: number[] | undefined;
    let labels: string[] | undefined;
    service.data.subscribe((d) => (data = d));
    service.labels.subscribe((l) => (labels = l));

    service.updateData('artDerBeratung', {}, range);

    httpMock
      .expectOne((r) => r.url.includes('/stats/contactDocumentation'))
      .flush([{ artDerBetreuung: 0 }, { artDerBetreuung: 0 }, { artDerBetreuung: 1 }]);

    expect(data).toEqual([2, 1, 0, 0, 0, 0, 0]);
    expect(labels?.length).toBe(7);
  });

  it('ziel tallies zielvereinbarungen by status', () => {
    let data: number[] | undefined;
    let labels: string[] | undefined;
    service.data.subscribe((d) => (data = d));
    service.labels.subscribe((l) => (labels = l));

    service.updateData('ziel', {}, range);

    httpMock.expectOne((r) => r.url.includes('/stats/case')).flush([
      { zielvereinbarungen: [{ status: 'inProgress' }, { status: 'done' }] },
      { zielvereinbarungen: [{ status: 'failed' }] },
    ]);

    expect(data).toEqual([1, 1, 1]);
    expect(labels).toEqual(['In Arbeit', 'Abgeschlossen', 'Fehlgeschlagen']);
  });

  it('ort tallies cases per city', () => {
    let data: number[] | undefined;
    let labels: string[] | undefined;
    service.data.subscribe((d) => (data = d));
    service.labels.subscribe((l) => (labels = l));

    service.updateData('ort', {}, range);

    httpMock.expectOne((r) => r.url.includes('/stats/cities')).flush(['Berlin', 'Hamburg']);
    httpMock
      .expectOne((r) => r.url.includes('/stats/case') && !r.url.includes('count'))
      .flush([{ city: 'Berlin' }, { city: 'Berlin' }, { city: 'Hamburg' }]);

    expect(data).toEqual([2, 1]);
    expect(labels).toEqual(['Berlin', 'Hamburg']);
  });
});
