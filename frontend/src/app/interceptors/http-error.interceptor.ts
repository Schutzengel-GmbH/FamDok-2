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

/**
 * The backend's error detail (`{ message, error }`, see backend/util/routerUtils.ts). The
 * superJSON interceptor requests every response as text, so the body arrives as a JSON string.
 */
function errorDetail(err: HttpErrorResponse): string | undefined {
  let body = err.error;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return undefined;
    }
  }
  return typeof body?.error === 'string' && body.error ? body.error : undefined;
}

export function httpErrorInterceptor(
  req: HttpRequest<any>,
  next: HttpHandlerFn,
): Observable<HttpEvent<any>> {
  const toastService = inject(ToastService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const detail = errorDetail(err);
      toastService.show({
        title: `Fehler ${err.status}`,
        text: detail ? `${errorMessage(err)}: ${detail}` : errorMessage(err),
        severity: 'danger',
      });
      return throwError(() => err);
    }),
  );
}
