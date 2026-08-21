import { Component, inject, linkedSignal, model, signal } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import {
  getPercentileDatasets,
  getWeightForMonth,
} from 'src/app/util/healthDataUtils';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ThemeService } from 'src/app/services/theme.service';
import { ChildModel as Child } from '../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-weight-chart',
  imports: [FormsModule, BaseChartDirective],
  standalone: true,
  templateUrl: './weight-chart.component.html',
  styleUrl: './weight-chart.component.css',
})
export class WeightChartComponent {
  private themeService = inject(ThemeService);
  private theme = toSignal(this.themeService.theme, { requireSync: true });

  child = model<Child | undefined>(undefined);
  ageRange = signal<0 | 1 | 2>(0);

  data = linkedSignal<
    { child: Child | undefined; ageRange: 0 | 1 | 2 },
    ChartData
  >({
    source: () => ({ child: this.child(), ageRange: this.ageRange() }),
    computation: ({ child, ageRange }) => {
      if (!child) return { datasets: [] };
      else
        return {
          labels: this.getMonthArray(),
          datasets: [
            {
              label: child.name,
              borderColor: this.theme() === 'light' ? 'rbga(0,0,0,1)' : 'white',
              spanGaps: true,

              data: this.getChildData(),
            },
            ...getPercentileDatasets(child.gender, ageRange),
          ],
        };
    },
  });

  options: ChartOptions = {};

  getChildData() {
    if (!this.child()) return [];
    const monthArray = this.getMonthArray();
    const healthData = this.child()!.healthData;
    return monthArray.map((m) => {
      return getWeightForMonth(
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
