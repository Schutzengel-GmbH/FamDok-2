import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { KeySessionService } from 'src/app/services/key-session.service';

/** States in which pages with personal data can be shown. */
const READY = ['unlocked', 'orgNotSetUp', 'notNeeded'];

/**
 * Keeps pages with personal data closed until the org data key is unlocked in this tab, and
 * sends the user to the encryption page instead (unlock, set up, wait for access), with the
 * page they wanted as `returnUrl`. Orgs without encryption yet and roles without keys pass.
 */
export const encryptionGuard = (): CanActivateFn => {
  return async (_route, state) => {
    const session = inject(KeySessionService);
    const router = inject(Router);
    try {
      await session.ensureLoaded();
    } catch {
      return router.createUrlTree(['/verschluesselung'], {
        queryParams: { returnUrl: state.url },
      });
    }
    if (READY.includes(session.state())) return true;
    return router.createUrlTree(['/verschluesselung'], {
      queryParams: { returnUrl: state.url },
    });
  };
};
