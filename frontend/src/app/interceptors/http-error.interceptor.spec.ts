import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { httpErrorInterceptor } from './http-error.interceptor';
import { ToastService } from '../services/toast.service';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    toastService = jasmine.createSpyObj('ToastService', ['show']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toastService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('shows a toast with a known message for a recognized status code', (done) => {
    http.get('/api/thing').subscribe({
      error: () => {
        expect(toastService.show).toHaveBeenCalledWith(
          jasmine.objectContaining({ title: 'Fehler 404', severity: 'danger' }),
        );
        done();
      },
    });

    httpMock
      .expectOne('/api/thing')
      .flush({ error: 'not found' }, { status: 404, statusText: 'Not Found' });
  });

  const cases: [number, string][] = [
    [400, 'Fehlerhafte Eingaben'],
    [401, 'Nicht autorisiert'],
    [403, 'Nicht erlaubt'],
    [404, 'Nicht gefunden'],
    [500, 'Interner Serverfehler'],
    [502, 'Gateway Fehler'],
  ];
  for (const [status, message] of cases) {
    it(`maps status ${status} to "${message}"`, (done) => {
      http.get('/api/thing').subscribe({
        error: () => {
          expect(toastService.show).toHaveBeenCalledWith(
            jasmine.objectContaining({
              title: `Fehler ${status}`,
              text: jasmine.stringContaining(message),
            }),
          );
          done();
        },
      });

      httpMock
        .expectOne('/api/thing')
        .flush({}, { status, statusText: 'Error' });
    });
  }

  it('falls back to a generic message for an unrecognized status code', (done) => {
    http.get('/api/thing').subscribe({
      error: () => {
        expect(toastService.show).toHaveBeenCalledWith(
          jasmine.objectContaining({
            text: jasmine.stringContaining('unerwarteter Fehler'),
          }),
        );
        done();
      },
    });

    httpMock.expectOne('/api/thing').flush({}, { status: 418, statusText: "I'm a teapot" });
  });

  it('re-throws the error after showing the toast', (done) => {
    http.get('/api/thing').subscribe({
      next: () => fail('expected an error'),
      error: (err) => {
        expect(err.status).toBe(500);
        done();
      },
    });

    httpMock.expectOne('/api/thing').flush({}, { status: 500, statusText: 'Server Error' });
  });
});
