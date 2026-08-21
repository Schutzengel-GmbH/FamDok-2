import {
  HttpErrorResponse,
  HttpRequest,
  HttpEvent,
  HttpHandlerFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

function errorMessage(err: HttpErrorResponse): string {
  switch (err.status) {
    case 400:
      return 'Fehlerhafte Eingaben';
    case 401:
      return 'Nicht autorisiert';
    case 403:
      return 'Nicht erlaubt';
    case 404:
      return 'Nicht gefunden';
    case 500:
      return 'Interner Serverfehler';
    case 502:
      return 'Gateway Fehler';
    default:
      return 'unerwarteter Fehler: ' + err.message;
  }
}

export function httpErrorInterceptor(
  req: HttpRequest<any>,
  next: HttpHandlerFn,
): Observable<HttpEvent<any>> {
  const toastService = inject(ToastService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      toastService.show({
        title: `Fehler ${err.status}`,
        text: `${errorMessage(err)}: ${err?.error?.error}`,
        severity: 'danger',
      });
      return throwError(() => err);
    }),
  );
}
