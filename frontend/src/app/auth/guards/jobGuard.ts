import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MeService } from 'src/app/services/me.service';
import { firstValueFrom } from 'rxjs';

export const jobGuard =
  (jobTitles: string[], redirectRoute?: string): CanActivateFn =>
  async () => {
    const meService = inject(MeService);
    const router = inject(Router);

    const authorisedUser = await firstValueFrom(meService.getMe());

    return (
      (authorisedUser.jobTitle &&
        jobTitles.includes(authorisedUser.jobTitle)) ||
      router.createUrlTree([redirectRoute || 'forbidden'])
    );
  };
