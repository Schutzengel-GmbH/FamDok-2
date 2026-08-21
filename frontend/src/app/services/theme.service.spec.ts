import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  afterEach(() => localStorage.removeItem('theme'));

  it('restores the previously saved theme from localStorage', () => {
    localStorage.setItem('theme', 'dark');

    TestBed.inject(ThemeService);

    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });

  it('defaults to light when nothing is saved and the system has no preference', (done) => {
    const service = TestBed.inject(ThemeService);

    service.theme.subscribe((theme) => {
      expect(theme).toBe('light');
      done();
    });
  });

  it('toggles between light and dark and persists the choice', () => {
    localStorage.setItem('theme', 'light');
    const service = TestBed.inject(ThemeService);

    service.toggle();

    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    service.toggle();

    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('light');
  });
});
