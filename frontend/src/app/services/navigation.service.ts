import { inject, Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

interface HistoryEntry {
  /** Router navigation id - Angular stores it in history.state, so popstate can be matched. */
  id: number;
  url: string;
}

/**
 * Mirrors the browser history entries created inside this app, so "go back to where we came
 * from" can tell whether there *is* a previous in-app page. Without that, `location.back()` on a
 * deep link or a freshly opened tab would leave the app (or do nothing).
 *
 * Instantiated at startup (see main.ts) so the very first navigation is recorded too.
 */
@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  private router = inject(Router);
  private location = inject(Location);

  private entries: HistoryEntry[] = [];
  private index = -1;

  private pending:
    | {
        trigger?: string;
        restoredId?: number;
        replaceUrl: boolean;
        skipLocationChange: boolean;
      }
    | undefined;

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) {
        const extras = this.router.currentNavigation()?.extras;
        this.pending = {
          trigger: e.navigationTrigger,
          restoredId: e.restoredState?.navigationId,
          replaceUrl: !!extras?.replaceUrl,
          skipLocationChange: !!extras?.skipLocationChange,
        };
      } else if (e instanceof NavigationEnd) {
        this.record(e);
      }
    });
  }

  /** Whether there is an earlier in-app page to go back to. */
  get canGoBack(): boolean {
    return this.index > 0;
  }

  /** Browser-back if there is an earlier in-app page, otherwise navigates to `fallback`. */
  back(fallback = '/'): void {
    if (this.canGoBack) this.location.back();
    else this.router.navigateByUrl(fallback);
  }

  private record(e: NavigationEnd) {
    const pending = this.pending;
    this.pending = undefined;
    const entry = { id: e.id, url: e.urlAfterRedirects };

    if (pending?.skipLocationChange) return;

    // Back/forward: jump to the entry the browser restored, if we know it.
    if (pending?.trigger === 'popstate' && pending.restoredId !== undefined) {
      const restored = this.entries.findIndex(
        (h) => h.id === pending.restoredId,
      );
      if (restored !== -1) {
        this.index = restored;
        // Angular re-stamps the restored history entry with the new navigation id.
        this.entries[restored] = entry;
      } else {
        // An entry from before a page reload - we can't know what's around it, so start over.
        this.entries = [entry];
        this.index = 0;
      }
      return;
    }

    // Like the router itself: an explicit replaceUrl, or navigating to the URL we're already on,
    // replaces the current history entry instead of pushing a new one.
    const current = this.entries[this.index];
    if (current && (pending?.replaceUrl || current.url === entry.url)) {
      this.entries[this.index] = entry;
      return;
    }

    this.entries = [...this.entries.slice(0, this.index + 1), entry];
    this.index = this.entries.length - 1;
  }
}
