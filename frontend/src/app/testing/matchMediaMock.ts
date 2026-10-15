/**
 * Stubs `window.matchMedia` so specs that depend on `prefers-color-scheme` (via
 * `ThemeService`) get a deterministic starting theme, regardless of the actual OS/browser
 * running the tests - without this, `(prefers-color-scheme: dark)` reflects whatever color
 * scheme the test machine happens to prefer, making `ThemeService`-dependent specs pass or
 * fail depending on who/where they're run.
 */
export function mockMatchMedia(prefersDark: boolean): void {
  spyOn(window, 'matchMedia').and.returnValue({
    matches: prefersDark,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as MediaQueryList);
}
