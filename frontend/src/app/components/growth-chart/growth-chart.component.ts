import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  signal,
} from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import {
  ageInMonths,
  getPercentileDatasets,
  GrowthMetric,
} from 'src/app/util/healthDataUtils';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ThemeService } from 'src/app/services/theme.service';
import { ChildModel as Child } from '../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-growth-chart',
  imports: [FormsModule, BaseChartDirective],
  standalone: true,
  templateUrl: './growth-chart.component.html',
})
export class GrowthChartComponent {
  private themeService = inject(ThemeService);
  private theme = toSignal(this.themeService.theme, { requireSync: true });

  child = model<Child | undefined>(undefined);
  metric = input<GrowthMetric>('weight');
  ageRange = signal<0 | 1 | 2>(0);

  // unique per instance so the age-range <select>/<label> pair stays valid
  // when two charts (weight + height) render on the same page
  protected ageRangeId = `ageRange-${Math.random().toString(36).slice(2)}`;

  data = linkedSignal<
    { child: Child | undefined; ageRange: 0 | 1 | 2; metric: GrowthMetric },
    ChartData
  >({
    source: () => ({
      child: this.child(),
      ageRange: this.ageRange(),
      metric: this.metric(),
    }),
    computation: ({ child, ageRange, metric }) => {
      if (!child) return { datasets: [] };
      else
        return {
          datasets: [
            {
              label: child.name,
              borderColor: this.theme() === 'light' ? 'rgba(0,0,0,1)' : 'white',
              spanGaps: true,
              data: this.getChildData(),
            },
            ...getPercentileDatasets(child.gender, ageRange, metric),
          ],
        };
    },
  });

  options = computed<ChartOptions>(() => ({
    scales: {
      x: {
        type: 'linear',
        min: this.ageRange() * 12,
        max: this.ageRange() * 12 + 12,
        title: { text: 'Alter (in Monaten)', display: true },
        ticks: { stepSize: 1 },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => {
            const age = (items[0]?.parsed as { x?: number } | undefined)?.x;
            return age != null
              ? `${age.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Monate`
              : '';
          },
        },
      },
    },
  }));

  getChildData() {
    const child = this.child();
    if (!child) return [];

    const min = this.ageRange() * 12;
    const max = min + 12;
    return (child.healthData ?? [])
      .map((h) => ({
        x: ageInMonths(new Date(child.dateOfBirth), new Date(h.date)),
        y: this.metric() === 'height' ? h.sizeCm : h.weightKg,
      }))
      .filter(
        (v): v is { x: number; y: number } =>
          v.y != null && v.x >= min && v.x <= max,
      );
  }
}
