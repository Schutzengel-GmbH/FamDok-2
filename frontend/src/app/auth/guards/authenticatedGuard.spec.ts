import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import Keycloak from 'keycloak-js';

import { authenticatedGuard } from './authenticatedGuard';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';

describe('authenticatedGuard', () => {
  function setup(authenticated: boolean) {
    const keycloak = mockKeycloak({ authenticated });
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Keycloak, useValue: keycloak }],
    });
    return keycloak;
  }

  it('allows activation when the user is authenticated', async () => {
    const keycloak = setup(true);

    const result = await TestBed.runInInjectionContext(() =>
      authenticatedGuard()({} as any, {} as any),
    );

    expect(result).toBeTrue();
    expect(keycloak.login).not.toHaveBeenCalled();
  });

  it('redirects to login and blocks activation when not authenticated', async () => {
    const keycloak = setup(false);

    const result = await TestBed.runInInjectionContext(() =>
      authenticatedGuard()({} as any, {} as any),
    );

    expect(result).toBeFalse();
    expect(keycloak.login).toHaveBeenCalled();
  });
});
