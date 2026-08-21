import { Component, effect, inject, input, OnInit } from '@angular/core';
import { CommonModule, NgForOf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PieChart } from '../../charts/pie-chart/pie-chart.component';
import { BarChart } from '../../charts/bar-chart/bar-chart.component';
import { ChartsService } from './chart.service';
import { StatsDashboardStateService } from 'src/app/services/stats-dashoard-state.service';
import { CaseWhereInput } from '../../../../../../shared/generated/prisma/models';

export type ChartKey = 'artDerBeratung' | 'ziel' | 'ort';

@Component({
  selector: 'app-stats-chart-card',
  standalone: true,
  imports: [CommonModule, NgForOf, FormsModule, PieChart, BarChart],
  templateUrl: './stats-chart-card.component.html',
  styleUrls: ['./stats-chart-card.component.scss'],
})
export class StatsChartCardComponent implements OnInit {
  private chartsService = inject(ChartsService);
  private stateService = inject(StatsDashboardStateService);

  data!: number[];
  labels!: string[];

  constructor() {
    effect(() => {
      this.update();
    });
  }

  update() {
    this.chartsService.updateData(
      this.selectedChartKey,
      this.filter(),
      this.range(),
    );
    this.stateService.updateState({ selectedChartKey: this.selectedChartKey });
  }

  ngOnInit() {
    this.chartsService.data.subscribe((data) => (this.data = data));
    this.chartsService.labels.subscribe((labels) => (this.labels = labels));
  }

  filter = input<CaseWhereInput>();
  range = input.required<{ start: Date; end: Date }>();

  availableCharts: { key: ChartKey; label: string }[] = [
    { key: 'artDerBeratung', label: 'Kontakte nach Art' },
    { key: 'ziel', label: 'Zielvereinbarungen nach Status' },
    { key: 'ort', label: 'Aktive Fälle nach Ort' },
  ];

  selectedChartKey: ChartKey =
    this.stateService.state.selectedChartKey || 'artDerBeratung';
}
