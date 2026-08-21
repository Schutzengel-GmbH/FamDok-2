import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import Keycloak from 'keycloak-js';
import { MeService } from 'src/app/services/me.service';
import { firstValueFrom } from 'rxjs';
import { Role } from '../../../../../shared/generated/prisma/enums';

/**
 * Guard CanActivateFn function to prevent users with insufficient roles to access a route.
 * If no user is logged in, redirects to login.
 * @param roles Array of allowed Roles
 */
export const roleGuard = (roles: Role[]): CanActivateFn => {
  return async () => {
    const keycloak = inject(Keycloak);
    const router: Router = inject(Router);

    if (!keycloak.authenticated) {
      keycloak.login();
      return false;
    }

    const meService = inject(MeService);
    const authenticatedUser = await firstValueFrom(meService.getMe());

    return (
      roles.includes(authenticatedUser.role) ||
      router.createUrlTree(['error'], {
        queryParams: {
          code: 403,
          title: 'Nicht erlaubt',
          message: 'Sie können auf diese Seite nicht zugreifen',
        },
      })
    );
  };
};
