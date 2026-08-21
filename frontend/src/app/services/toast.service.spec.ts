import { TestBed } from '@angular/core/testing';

import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    service = TestBed.inject(ToastService);
  });

  it('starts with no toasts', () => {
    expect(service.toasts()).toEqual([]);
  });

  it('adds a toast on show', () => {
    const toast = { title: 'Gespeichert', text: 'Erfolgreich', severity: 'success' as const };

    service.show(toast);

    expect(service.toasts()).toEqual([toast]);
  });

  it('removes a toast', () => {
    const toast = { title: 'Gespeichert', text: 'Erfolgreich', severity: 'success' as const };
    service.show(toast);

    service.remove(toast);

    expect(service.toasts()).toEqual([]);
  });

  it('keeps multiple toasts independently', () => {
    const a = { title: 'A', text: 'a', severity: 'info' as const };
    const b = { title: 'B', text: 'b', severity: 'danger' as const };
    service.show(a);
    service.show(b);

    service.remove(a);

    expect(service.toasts()).toEqual([b]);
  });
});
