import { Injectable, NgZone, inject, signal } from '@angular/core';

export interface ToastInfo {
  title: string;
  text: string;
  severity: 'info' | 'success' | 'warning' | 'danger';
  delay?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private ngZone = inject(NgZone);
  private _toasts = signal<ToastInfo[]>([]);
  readonly toasts = this._toasts.asReadonly();

  // show()/remove() can be called from outside Angular's zone (e.g. the keycloak-angular
  // token-refresh machinery runs parts of the HTTP pipeline via runOutsideAngular), in which
  // case a signal write alone doesn't schedule a change-detection tick to paint it - forcing
  // the run back into the zone guarantees the toast renders immediately instead of waiting for
  // some unrelated zone-tracked event (like a navigation) to flush it.
  show(toastInfo: ToastInfo) {
    this.ngZone.run(() => {
      this._toasts.update((toasts) => toasts.concat(toastInfo));
    });
  }

  remove(toastInfo: ToastInfo) {
    this.ngZone.run(() => {
      this._toasts.update((toasts) => toasts.filter((t) => t != toastInfo));
    });
  }
}
