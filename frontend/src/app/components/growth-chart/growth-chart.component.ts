import {
  Component,
  inject,
  input,
  linkedSignal,
  model,
  signal,
} from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import {
  getPercentileDatasets,
  getSizeForMonth,
  getWeightForMonth,
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
          labels: this.getMonthArray(),
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

  options: ChartOptions = {};

  getChildData() {
    if (!this.child()) return [];
    const monthArray = this.getMonthArray();
    const healthData = this.child()!.healthData;
    const getForMonth =
      this.metric() === 'height' ? getSizeForMonth : getWeightForMonth;
    return monthArray.map((m) => {
      return getForMonth(
        healthData || [],
        new Date(this.child()!.dateOfBirth),
        m,
      );
    });
  }

  getMonthArray() {
    return [...Array(12).keys()].map((n) => n + this.ageRange() * 12);
  }
}
