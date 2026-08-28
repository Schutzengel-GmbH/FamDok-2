import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Settings } from '../../../../shared/types';
import { environment } from 'src/environments/environment';
import {
  catchError,
  map,
  Observable,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';

const CACHE_SIZE = 1;

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private http = inject(HttpClient);
  protected settingsApiUrl = environment.apiUrl + '/settings';

  private settingsCache$: Observable<Settings> | undefined;

  getSettings(): Observable<Settings> {
    if (!this.settingsCache$)
      this.settingsCache$ = this.http
        .get<{ name: string; value: string }[]>(this.settingsApiUrl)
        .pipe(
          map((result) => ({
            closing_doc:
              result.find((s) => s.name === 'closing_doc')?.value || '',
            personal_data_retention_days:
              result.find((s) => s.name === 'personal_data_retention_days')
                ?.value || '',
          })),
          catchError((err) => {
            this.settingsCache$ = undefined;
            return throwError(() => err);
          }),
        )
        .pipe(shareReplay(CACHE_SIZE));
    return this.settingsCache$;
  }

  /** Admin-only: sets a setting and invalidates the cache so subsequent getSettings() re-fetches. */
  updateSetting(
    name: keyof Settings,
    value: string,
  ): Observable<{ name: string; value: string }> {
    return this.http
      .put<{ name: string; value: string }>(
        `${this.settingsApiUrl}/${name}`,
        { value },
      )
      .pipe(tap(() => (this.settingsCache$ = undefined)));
  }
}
