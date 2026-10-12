import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import {
  catchError,
  MonoTypeOperatorFunction,
  Observable,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { Warning } from '../../../../shared/types';

const CACHE_SIZE = 1;

@Injectable({
  providedIn: 'root',
})
export class WarningsService {
  private http = inject(HttpClient);
  private warningsUrl = environment.apiUrl + '/warnings';

  private warningsCache$: Observable<Warning[]> | undefined;

  /**
   * Get the current list of warnings, shared across all callers.
   * @returns
   */
  getWarnings(): Observable<Warning[]> {
    if (!this.warningsCache$) {
      this.warningsCache$ = this.requestWarnings().pipe(
        catchError((err) => {
          this.warningsCache$ = undefined;
          return throwError(() => err);
        }),
        shareReplay(CACHE_SIZE),
      );
    }
    return this.warningsCache$;
  }

  /**
   * Forces a re-fetch, e.g. after the user resolves a warning.
   * @returns the fresh warnings list
   */
  refresh(): Observable<Warning[]> {
    this.warningsCache$ = undefined;
    return this.getWarnings();
  }

  /**
   * Operator that refreshes the warnings once the source emits. Pipe it onto requests that can
   * add or resolve warnings (e.g. saving a form), so the shared cache doesn't go stale.
   * @returns the operator, passing the source values through unchanged
   */
  refreshAfter<T>(): MonoTypeOperatorFunction<T> {
    return tap(() => this.refresh().subscribe({ error: () => {} }));
  }

  private requestWarnings() {
    return this.http.get<Warning[]>(this.warningsUrl);
  }
}
