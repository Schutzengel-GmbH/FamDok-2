import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Settings } from '../../../../shared/types';
import { environment } from 'src/environments/environment';
import { catchError, map, Observable, shareReplay, throwError } from 'rxjs';

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
          })),
          catchError((err) => {
            this.settingsCache$ = undefined;
            return throwError(() => err);
          }),
        )
        .pipe(shareReplay(CACHE_SIZE));
    return this.settingsCache$;
  }
}
