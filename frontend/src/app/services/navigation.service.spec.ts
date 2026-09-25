import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';

import { NavigationService } from './navigation.service';

@Component({ template: '' })
class Blank {}

describe('NavigationService', () => {
  let service: NavigationService;
  let router: Router;
  let location: Location;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideLocationMocks(),
        provideRouter([
          { path: '', component: Blank },
          { path: 'a', component: Blank },
          { path: 'b', component: Blank },
          { path: 'c', component: Blank },
        ]),
      ],
    });
    service = TestBed.inject(NavigationService);
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    // Normally done by the app's initial navigation - needed for browser back/forward.
    router.setUpLocationChangeListener();
    await router.navigateByUrl('/a');
  });

  /** Browser back via the mocked Location, waiting for the resulting popstate navigation. */
  async function browserBack() {
    const done = firstValueFrom(
      router.events.pipe(filter((e) => e instanceof NavigationEnd)),
    );
    location.back();
    await done;
  }

  it('cannot go back on the first page (deep link / new tab)', () => {
    expect(service.canGoBack).toBeFalse();
  });

  it('falls back to the given url when there is no earlier in-app page', async () => {
    service.back('/c');
    await new Promise((r) => setTimeout(r));

    expect(location.path()).toBe('/c');
  });

  it('goes back in browser history after an in-app navigation', async () => {
    await router.navigateByUrl('/b');
    expect(service.canGoBack).toBeTrue();

    service.back();
    await new Promise((r) => setTimeout(r));

    expect(location.path()).toBe('/a');
  });

  it('does not count replaceUrl navigations as a new page', async () => {
    await router.navigateByUrl('/b', { replaceUrl: true });

    expect(service.canGoBack).toBeFalse();
  });

  it('does not count navigating to the current url as a new page', async () => {
    await router.navigateByUrl('/b');
    await router.navigateByUrl('/b');

    service.back();
    await new Promise((r) => setTimeout(r));

    expect(location.path()).toBe('/a');
  });

  it('follows browser back/forward', async () => {
    await router.navigateByUrl('/b');
    await router.navigateByUrl('/c');

    await browserBack();
    expect(location.path()).toBe('/b');
    expect(service.canGoBack).toBeTrue();

    await browserBack();
    expect(location.path()).toBe('/a');
    expect(service.canGoBack).toBeFalse();
  });
});
