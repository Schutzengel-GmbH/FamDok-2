import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { StatsService } from './stats.service';
import { environment } from 'src/environments/environment';
import { Status } from '../../../../shared/generated/prisma/enums';

describe('StatsService', () => {
  let service: StatsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StatsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getAnonCases GETs anonymised cases', () => {
    service.getAnonCases().subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/stats/case') && !r.url.includes('count'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getAnonCases encodes the given filter and activeBetween range', () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-02-01');
    service.getAnonCases({ city: 'Berlin' } as any, { start, end }).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url.includes('/stats/case') && !r.url.includes('count'),
    );
    expect(decodeURIComponent(req.request.url)).toContain('"city":"Berlin"');
    expect(decodeURIComponent(req.request.url)).toContain('"activeBetween":');
    req.flush([]);
  });

  it('getCities GETs the city list', () => {
    service.getCities().subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/stats/cities`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getContactStats GETs anonymised contact documentation', () => {
    let result: unknown;
    service.getContactStats({} as any, {} as any).subscribe((r) => (result = r));

    httpMock.expectOne((r) => r.url.includes('/stats/contactDocumentation')).flush([]);

    expect(result).toEqual([]);
  });

  it('countCases GETs the case count', () => {
    let result: unknown;
    service.countCases({} as any).subscribe((r) => (result = r));

    httpMock.expectOne((r) => r.url.includes('/stats/case/count')).flush(10);

    expect(result).toBe(10);
  });

  it('countCases encodes the activeBetween range when given', () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-02-01');
    service.countCases({} as any, { start, end }).subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('/stats/case/count'));
    expect(decodeURIComponent(req.request.url)).toContain('"activeBetween":');
    req.flush(10);
  });

  describe('filterInProgress / filterNotInProgress', () => {
    it('filterInProgress is true when at least one ziel is inProgress', () => {
      const c = { zielvereinbarungen: [{ status: Status.inProgress }] } as any;

      expect(service.filterInProgress(c)).toBeTrue();
    });

    it('filterInProgress is false when none are inProgress', () => {
      const c = { zielvereinbarungen: [{ status: Status.done }] } as any;

      expect(service.filterInProgress(c)).toBeFalse();
    });

    it('filterNotInProgress is true only when none are inProgress', () => {
      const c = { zielvereinbarungen: [{ status: Status.done }] } as any;

      expect(service.filterNotInProgress(c)).toBeTrue();
    });
  });

  describe('makeCaseFilter', () => {
    it('builds a contactDocumentation range filter for hasContact', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-02-01');

      const filter = service.makeCaseFilter({ hasContact: { start, end } });

      expect(filter.contactDocumentation).toEqual({
        some: { date: { gte: start, lte: end } },
      });
    });

    it('builds a filter for city and plz', () => {
      const filter = service.makeCaseFilter({ city: 'Berlin', plz: '10' });

      expect(filter.city).toEqual({ contains: 'Berlin' });
      expect(filter.plz).toEqual({ contains: '10' });
    });

    it('builds a zielvereinbarungen range filter for hasZielvereinbarungen', () => {
      const start = new Date('2026-01-01');
      const end = new Date('2026-02-01');

      const filter = service.makeCaseFilter({ hasZielvereinbarungen: { start, end } });

      expect(filter.zielvereinbarungen).toEqual({
        some: { startedAt: { gte: start }, finishBy: { lte: end } },
      });
    });

    it('returns an empty filter when nothing is given', () => {
      expect(service.makeCaseFilter({})).toEqual({});
    });
  });
});
