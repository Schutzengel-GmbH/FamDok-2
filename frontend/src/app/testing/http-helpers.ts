import { HttpTestingController } from '@angular/common/http/testing';

/**
 * Flushes the `/settings` GET request that `CaseService`'s constructor always fires (via
 * `SettingsService`), regardless of which component pulled it in. Needed before most
 * `CaseService`-dependent specs will settle, since SettingsService's response shape (an array)
 * would otherwise crash the internal `.find()` if left unflushed or flushed with the wrong shape.
 */
export function flushSettings(httpMock: HttpTestingController) {
  httpMock.match((r) => r.url.includes('/settings')).forEach((r) => r.flush([]));
}

/**
 * Flushes the `/warnings` GET that `WarningsService.refreshAfter()` fires after a request that
 * can change warnings (e.g. saving a contact documentation or case form response).
 */
export function flushWarnings(httpMock: HttpTestingController) {
  httpMock.match((r) => r.url.includes('/warnings')).forEach((r) => r.flush([]));
}
