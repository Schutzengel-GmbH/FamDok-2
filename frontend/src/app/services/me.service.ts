import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import Keycloak from 'keycloak-js';
import { FullUser } from '../../../../shared/types';
import { catchError, Observable, of, shareReplay, tap, throwError } from 'rxjs';

const CACHE_SIZE = 1;

@Injectable({
  providedIn: 'root',
})
export class MeService {
  private http = inject(HttpClient);
  private keycloak = inject(Keycloak);
  userApiUrl = environment.apiUrl + '/me';

  /**
   * Get the currently logged in user's Keycloak ID.
   * @returns Keycloak ID string
   */
  getKCId() {
    return this.keycloak.tokenParsed?.sub;
  }

  private userCache$: Observable<FullUser> | undefined;

  /**
   * Get user info for the currently signed in user.
   * @returns
   */
  getMe() {
    if (!this.userCache$) {
      this.userCache$ = this.requestMe().pipe(
        catchError((err) => {
          this.userCache$ = undefined;
          return throwError(() => err);
        }),
        shareReplay(CACHE_SIZE),
      );
    }
    return this.userCache$;
  }

  /**
   * Update user information for the currently signed in user.
   * @param firstName
   * @param lastName
   * @returns
   */
  update(firstName: string, lastName: string) {
    return this.http
      .put<FullUser>(this.userApiUrl, { firstName, lastName })
      .pipe(tap((user) => this.updateCache(user)));
  }

  private updateCache(user: FullUser) {
    this.userCache$ = of(user).pipe(shareReplay(CACHE_SIZE));
  }

  private requestMe() {
    return this.http.get<FullUser>(this.userApiUrl);
  }
}
