import { TestBed } from '@angular/core/testing';

import { StatsDashboardStateService } from './stats-dashoard-state.service';

describe('StatsDashboardStateService', () => {
  let service: StatsDashboardStateService;

  beforeEach(() => {
    localStorage.removeItem('STATS_STATE');
    service = TestBed.inject(StatsDashboardStateService);
  });

  afterEach(() => localStorage.removeItem('STATS_STATE'));

  it('defaults to a one-year range when nothing is saved', () => {
    const state = service.state;

    expect(Math.abs(state.range.end.getTime() - Date.now())).toBeLessThan(60_000);
    expect(state.city).toBeUndefined();
  });

  it('persists and merges updates, round-tripping Date values', () => {
    service.updateState({ city: 'Berlin' });
    service.updateState({ plz: '12345' });

    const state = service.state;

    expect(state.city).toBe('Berlin');
    expect(state.plz).toBe('12345');
    expect(state.range.start instanceof Date).toBeTrue();
  });

  it('overwrites a field on repeated updates', () => {
    service.updateState({ city: 'Berlin' });
    service.updateState({ city: 'Hamburg' });

    expect(service.state.city).toBe('Hamburg');
  });
});
