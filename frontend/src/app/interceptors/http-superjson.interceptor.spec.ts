import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import SuperJSON from 'superjson';

import { superJSONInterceptor } from './http-superjson.interceptor';

describe('superJSONInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([superJSONInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requests the response as text and parses SuperJSON-encoded dates back into real Date objects', (done) => {
    const payload = { name: 'Muster', createdAt: new Date('2026-03-15') };

    http.get<typeof payload>('/api/thing').subscribe((result) => {
      expect(result.name).toBe('Muster');
      expect(result.createdAt instanceof Date).toBeTrue();
      expect((result.createdAt as unknown as Date).getTime()).toBe(payload.createdAt.getTime());
      done();
    });

    const req = httpMock.expectOne('/api/thing');
    expect(req.request.responseType).toBe('text');
    req.flush(SuperJSON.stringify(payload));
  });

  it('leaves non-json response types untouched', () => {
    http.get('/api/thing', { responseType: 'blob' }).subscribe();

    const req = httpMock.expectOne('/api/thing');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });
});
