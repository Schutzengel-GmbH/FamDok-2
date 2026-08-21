import { Component, computed, model } from '@angular/core';
import {
  ChartConfiguration,
  ChartData,
  ChartDataset,
  ChartType,
} from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [BaseChartDirective],
  template: `<canvas
    baseChart
    [data]="data()"
    [type]="type"
    [options]="options"></canvas>`,
})
export class BarChart {
  datasets = model.required<ChartDataset<'bar', number[]>>();
  labels = model.required<string[]>();

  data = computed<ChartData<'bar', number[], string>>(() => ({
    datasets: [this.datasets()],
    labels: this.labels(),
  }));

  type: ChartType = 'bar';

  options: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(2,6,23,0.88)',
        titleColor: '#e5e7eb',
        bodyColor: '#9ca3af',
        borderColor: 'rgba(148,163,184,0.15)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
      },
    },
  };
}
