import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { encryptionFeatureGuard, encryptionGuard } from './encryptionGuard';
import { KeySessionService } from 'src/app/services/key-session.service';

describe('encryptionGuard', () => {
  function run(state: string, load: Promise<void> = Promise.resolve()) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: KeySessionService,
          useValue: { state: signal(state), ensureLoaded: () => load },
        },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      encryptionGuard()({} as any, { url: '/familien/1' } as any),
    ) as Promise<boolean | UrlTree>;
  }

  for (const state of ['unlocked', 'orgNotSetUp', 'notNeeded', 'disabled']) {
    it(`lets ${state} pass`, async () => {
      expect(await run(state)).toBeTrue();
    });
  }

  for (const state of ['locked', 'needsEnrolment', 'awaitingGrant', 'frozen', 'keyMismatch']) {
    it(`sends ${state} to the encryption page with the return URL`, async () => {
      const result = await run(state);
      const router = TestBed.inject(Router);
      expect(router.serializeUrl(result as UrlTree)).toBe(
        '/verschluesselung?returnUrl=%2Ffamilien%2F1',
      );
    });
  }

  it('sends the user to the encryption page if the status cannot be loaded', async () => {
    const result = await run('loading', Promise.reject(new Error('offline')));
    expect(result instanceof UrlTree).toBeTrue();
  });
});

describe('encryptionFeatureGuard', () => {
  function run(enabled: boolean, load: Promise<void> = Promise.resolve()) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: KeySessionService,
          useValue: { encryptionEnabled: signal(enabled), ensureLoaded: () => load },
        },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      encryptionFeatureGuard()({} as any, { url: '/schluesselverwaltung' } as any),
    ) as Promise<boolean | UrlTree>;
  }

  it('opens the encryption pages when the server offers encryption', async () => {
    expect(await run(true)).toBeTrue();
  });

  it('sends the user home when the server runs without encryption', async () => {
    const result = await run(false);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });

  it('opens the page if the status cannot be loaded, so it can show the error', async () => {
    expect(await run(false, Promise.reject(new Error('offline')))).toBeTrue();
  });
});
