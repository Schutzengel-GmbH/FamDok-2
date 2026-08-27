import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SettingsService } from './settings.service';
import { environment } from 'src/environments/environment';

describe('SettingsService', () => {
  let service: SettingsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SettingsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('maps the raw settings array into a settings object', () => {
    let result: unknown;
    service.getSettings().subscribe((s) => (result = s));

    httpMock
      .expectOne(`${environment.apiUrl}/settings`)
      .flush([{ name: 'closing_doc', value: 'form-1' }]);

    expect(result).toEqual({ closing_doc: 'form-1' });
  });

  it('defaults closing_doc to an empty string when not set', () => {
    let result: unknown;
    service.getSettings().subscribe((s) => (result = s));

    httpMock.expectOne(`${environment.apiUrl}/settings`).flush([]);

    expect(result).toEqual({ closing_doc: '' });
  });

  it('caches the result across subsequent calls', () => {
    service.getSettings().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/settings`).flush([]);

    service.getSettings().subscribe();

    expect(httpMock.match(`${environment.apiUrl}/settings`).length).toBe(0);
  });
});
