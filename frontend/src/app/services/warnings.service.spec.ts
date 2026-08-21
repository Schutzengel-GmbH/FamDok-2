import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { WarningsService } from './warnings.service';
import { environment } from 'src/environments/environment';

describe('WarningsService', () => {
  let service: WarningsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WarningsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('fetches warnings and caches the result across subsequent calls', () => {
    const warnings = [{ level: 0, type: 0, data: {} }];

    let first: unknown;
    let second: unknown;
    service.getWarnings().subscribe((w) => (first = w));
    httpMock.expectOne(`${environment.apiUrl}/warnings`).flush(warnings);
    service.getWarnings().subscribe((w) => (second = w));

    expect(first).toEqual(warnings as any);
    expect(second).toEqual(warnings as any);
    httpMock.expectNone(`${environment.apiUrl}/warnings`);
  });

  it('clears the cache and re-fetches when the request fails', () => {
    service.getWarnings().subscribe({ error: () => {} });
    httpMock
      .expectOne(`${environment.apiUrl}/warnings`)
      .flush('error', { status: 500, statusText: 'Server Error' });

    let result: unknown;
    service.getWarnings().subscribe((w) => (result = w));
    const warnings = [{ level: 1, type: 2, data: {} }];
    httpMock.expectOne(`${environment.apiUrl}/warnings`).flush(warnings);

    expect(result).toEqual(warnings as any);
  });

  it('refresh forces a new request even when a cached value exists', () => {
    service.getWarnings().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/warnings`).flush([]);

    let result: unknown;
    service.refresh().subscribe((w) => (result = w));
    const fresh = [{ level: 0, type: 1, data: {} }];
    httpMock.expectOne(`${environment.apiUrl}/warnings`).flush(fresh);

    expect(result).toEqual(fresh as any);
  });
});
