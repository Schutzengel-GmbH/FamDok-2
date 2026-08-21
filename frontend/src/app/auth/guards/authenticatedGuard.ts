import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import Keycloak from 'keycloak-js';

/**
 * Guard CanActivateFn function to prevent authenticated users from accessing a path.
 * If no user is logged in, redirects to login.
 * @param roles Array of allowed Roles
 */
export const authenticatedGuard = (): CanActivateFn => {
  return async () => {
    const keycloak = inject(Keycloak);

    if (!keycloak.authenticated) {
      keycloak.login();
      return false;
    }

    return true;
  };
};
