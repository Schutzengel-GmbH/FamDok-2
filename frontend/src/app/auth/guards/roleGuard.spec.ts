import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { of } from 'rxjs';
import Keycloak from 'keycloak-js';

import { roleGuard } from './roleGuard';
import { mockKeycloak } from 'src/app/testing/keycloak-mock';
import { MeService } from 'src/app/services/me.service';
import { Role } from '../../../../../shared/generated/prisma/enums';

describe('roleGuard', () => {
  function setup(authenticated: boolean, role?: Role) {
    const keycloak = mockKeycloak({ authenticated });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: Keycloak, useValue: keycloak },
        { provide: MeService, useValue: { getMe: () => of({ role } as any) } },
      ],
    });
    return keycloak;
  }

  it('redirects to login and blocks activation when not authenticated', async () => {
    const keycloak = setup(false);

    const result = await TestBed.runInInjectionContext(() =>
      roleGuard([Role.Admin])({} as any, {} as any),
    );

    expect(result).toBeFalse();
    expect(keycloak.login).toHaveBeenCalled();
  });

  it('allows activation when the user has one of the allowed roles', async () => {
    setup(true, Role.Admin);

    const result = await TestBed.runInInjectionContext(() =>
      roleGuard([Role.Admin])({} as any, {} as any),
    );

    expect(result).toBeTrue();
  });

  it('redirects to the error page with a 403 when the role is not allowed', async () => {
    setup(true, Role.User);

    const result = await TestBed.runInInjectionContext(() =>
      roleGuard([Role.Admin])({} as any, {} as any),
    );

    expect(result instanceof UrlTree).toBeTrue();
    expect((result as UrlTree).toString()).toContain('/error');
    expect((result as UrlTree).toString()).toContain('code=403');
  });
});
