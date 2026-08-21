/// <reference types="@angular/localize" />

import '../../shared/sharedGlobals';
import { enableProdMode, ErrorHandler } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { isDevMode } from '@angular/core';
import { provideZoneChangeDetection } from '@angular/core';
import {
  AutoRefreshTokenService,
  createInterceptorCondition,
  INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
  IncludeBearerTokenCondition,
  includeBearerTokenInterceptor,
  provideKeycloak,
  UserActivityService,
  withAutoRefreshToken,
} from 'keycloak-angular';
import { environment } from './environments/environment';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { httpErrorInterceptor } from './app/interceptors/http-error.interceptor';
import { ExceptionHandler } from './app/error-handler';
import { superJSONInterceptor } from './app/interceptors/http-superjson.interceptor';

async function main() {
  if (!isDevMode()) {
    enableProdMode();
  }

  // In Docker, config.json is rendered at container start from runtime
  // env vars (see frontend/docker-entrypoint.sh) and overrides the
  // build-time environment.ts/.prod.ts values below. Locally (`ng serve`),
  // no such file exists, so this silently falls back to the static values.
  try {
    const res = await fetch('/assets/config.json', { cache: 'no-store' });
    if (res.ok) Object.assign(environment, await res.json());
  } catch {
    // no runtime config available - keep static environment values
  }

  const apiUrlCondition =
    createInterceptorCondition<IncludeBearerTokenCondition>({
      urlPattern: new RegExp(`^${environment.apiUrl}`),
    });

  bootstrapApplication(AppComponent, {
    providers: [
      { provide: ErrorHandler, useClass: ExceptionHandler },
      provideKeycloak({
        config: {
          url: environment.keycloakUrl,
          realm: environment.keycloakRealm,
          clientId: environment.keycloakClient,
        },
        initOptions: {
          onLoad: 'check-sso',
          silentCheckSsoRedirectUri:
            window.location.origin + '/assets/silent-check-sso.html',
        },
        features: [
          withAutoRefreshToken({
            sessionTimeout: 10 * 60 * 1000,
            onInactivityTimeout: 'login',
          }),
        ],
        providers: [AutoRefreshTokenService, UserActivityService],
      }),
      {
        provide: INCLUDE_BEARER_TOKEN_INTERCEPTOR_CONFIG,
        useValue: [apiUrlCondition],
      },
      provideZoneChangeDetection(),
      provideRouter(routes),
      provideHttpClient(
        withInterceptors([
          includeBearerTokenInterceptor,
          httpErrorInterceptor,
          superJSONInterceptor,
        ]),
      ),
      provideRouter(routes),
      provideCharts(withDefaultRegisterables()),
    ],
  });
}

main();
