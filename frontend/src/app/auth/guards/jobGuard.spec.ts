import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlTree } from '@angular/router';
import { of } from 'rxjs';

import { jobGuard } from './jobGuard';
import { MeService } from 'src/app/services/me.service';

describe('jobGuard', () => {
  function setup(jobTitle: string | null) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MeService, useValue: { getMe: () => of({ jobTitle } as any) } },
      ],
    });
  }

  it('allows activation when the job title is in the allowed list', async () => {
    setup('Sozialarbeiter');

    const result = await TestBed.runInInjectionContext(() =>
      jobGuard(['Sozialarbeiter'])({} as any, {} as any),
    );

    expect(result).toBeTrue();
  });

  it('redirects to the default "forbidden" route when the job title is not allowed', async () => {
    setup('Praktikant');

    const result = await TestBed.runInInjectionContext(() =>
      jobGuard(['Sozialarbeiter'])({} as any, {} as any),
    );

    expect(result instanceof UrlTree).toBeTrue();
    expect((result as UrlTree).toString()).toBe('/forbidden');
  });

  it('redirects to a custom route when given one', async () => {
    setup(null);

    const result = await TestBed.runInInjectionContext(() =>
      jobGuard(['Sozialarbeiter'], 'custom-forbidden')({} as any, {} as any),
    );

    expect((result as UrlTree).toString()).toBe('/custom-forbidden');
  });
});
