import Keycloak from 'keycloak-js';

/**
 * Minimal fake of the `Keycloak` instance that `keycloak-angular`'s `provideKeycloak` normally
 * registers - real Keycloak tries to hit an actual server on construction, so tests provide this
 * instead via `{ provide: Keycloak, useValue: mockKeycloak() }`.
 */
export function mockKeycloak(overrides: Partial<Keycloak> = {}): Keycloak {
  return {
    authenticated: true,
    login: jasmine.createSpy('login'),
    logout: jasmine.createSpy('logout'),
    token: 'test-token',
    tokenParsed: {},
    ...overrides,
  } as unknown as Keycloak;
}
