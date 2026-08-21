import { Component, computed, model } from '@angular/core';
import {
  ChartConfiguration,
  ChartData,
  ChartDataset,
  ChartType,
} from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  selector: 'app-pie-chart',
  standalone: true,
  imports: [BaseChartDirective],
  template: `<canvas
    baseChart
    [data]="data()"
    [type]="type"
    [options]="options"></canvas>`,
})
export class PieChart {
  datasets = model.required<ChartDataset<'pie', number[]>>();
  labels = model.required<string[]>();

  data = computed<ChartData<'pie', number[], string>>(() => ({
    datasets: [this.datasets()],
    labels: this.labels(),
  }));

  type: ChartType = 'pie';

  options: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: {
        display: true,
        labels: {
          boxWidth: 12,
          boxHeight: 12,
          padding: 16,
          font: { size: 12 },
        },
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
