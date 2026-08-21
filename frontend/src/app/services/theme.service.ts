import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

type Theme = 'light' | 'dark';
const KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private current = new BehaviorSubject<Theme>('light');
  theme = this.current.asObservable();

  constructor() {
    const saved = (localStorage.getItem(KEY) as Theme) || this.prefers();
    this.apply(saved);
  }

  toggle() {
    this.apply(this.current.getValue() === 'light' ? 'dark' : 'light');
  }

  private apply(theme: Theme) {
    this.current.next(theme);
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem(KEY, theme);
  }

  private prefers(): Theme {
    return matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
}
