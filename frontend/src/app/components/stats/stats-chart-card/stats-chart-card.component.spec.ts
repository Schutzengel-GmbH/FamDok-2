import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { Subject } from 'rxjs';

import { StatsChartCardComponent } from './stats-chart-card.component';
import { ChartsService } from './chart.service';

describe('StatsChartCardComponent', () => {
  let component: StatsChartCardComponent;
  let fixture: ComponentFixture<StatsChartCardComponent>;
  let chartsService: jasmine.SpyObj<ChartsService>;

  beforeEach(async () => {
    localStorage.removeItem('STATS_STATE');
    chartsService = jasmine.createSpyObj('ChartsService', ['updateData'], {
      data: new Subject<number[]>(),
      labels: new Subject<string[]>(),
    });

    await TestBed.configureTestingModule({
      imports: [StatsChartCardComponent],
      providers: [
        provideCharts(withDefaultRegisterables()),
        { provide: ChartsService, useValue: chartsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsChartCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('range', {
      start: new Date('2026-01-01'),
      end: new Date('2026-02-01'),
    });
  });

  afterEach(() => localStorage.removeItem('STATS_STATE'));

  it('defaults to the artDerBeratung chart and lists all available charts', () => {
    fixture.detectChanges();

    expect(component.selectedChartKey).toBe('artDerBeratung');
    expect(component.availableCharts.map((c) => c.key)).toEqual([
      'artDerBeratung',
      'ziel',
      'ort',
    ]);
  });

  it('requests updated data via the charts service once the range is available', () => {
    fixture.detectChanges();

    expect(chartsService.updateData).toHaveBeenCalledWith(
      'artDerBeratung',
      undefined,
      { start: new Date('2026-01-01'), end: new Date('2026-02-01') },
    );
  });

  it('subscribes to data/labels emitted by the charts service', () => {
    fixture.detectChanges();

    (chartsService.data as Subject<number[]>).next([1, 2, 3]);
    (chartsService.labels as Subject<string[]>).next(['A', 'B', 'C']);

    expect(component.data).toEqual([1, 2, 3]);
    expect(component.labels).toEqual(['A', 'B', 'C']);
  });
});
