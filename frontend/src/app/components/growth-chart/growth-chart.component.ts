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
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ageRangeMonths, GrowthMetric } from 'src/app/util/healthDataUtils';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ThemeService } from 'src/app/services/theme.service';
import { ChildModel as Child } from '../../../../../shared/generated/prisma/models';
import {
  buildGrowthChartData,
  buildGrowthChartOptions,
  downloadDataUrl,
  getChildData,
  metricLabel,
  renderGrowthChartPng,
} from './growth-chart.config';
import { GrowthChartFullscreenModalComponent } from './growth-chart-fullscreen-modal/growth-chart-fullscreen-modal.component';

@Component({
  selector: 'app-growth-chart',
  imports: [FormsModule, BaseChartDirective],
  standalone: true,
  templateUrl: './growth-chart.component.html',
})
export class GrowthChartComponent {
  private themeService = inject(ThemeService);
  private modalService = inject(NgbModal);
  private theme = toSignal(this.themeService.theme, { requireSync: true });

  child = model<Child | undefined>(undefined);
  metric = input<GrowthMetric>('weight');
  ageRange = signal<0 | 1 | 2>(0);

  // unique per instance so the age-range <select>/<label> pair stays valid
  // when two charts (weight + height) render on the same page
  protected ageRangeId = `ageRange-${Math.random().toString(36).slice(2)}`;

  data = linkedSignal<
    {
      child: Child | undefined;
      ageRange: 0 | 1 | 2;
      metric: GrowthMetric;
      theme: 'light' | 'dark';
    },
    ChartData
  >({
    source: () => ({
      child: this.child(),
      ageRange: this.ageRange(),
      metric: this.metric(),
      theme: this.theme(),
    }),
    computation: ({ child, ageRange, metric, theme }) =>
      buildGrowthChartData(
        child,
        ageRange,
        ageRangeMonths(ageRange),
        metric,
        theme,
      ),
  });

  options = computed<ChartOptions>(() =>
    buildGrowthChartOptions(ageRangeMonths(this.ageRange())),
  );

  getChildData() {
    return getChildData(
      this.child(),
      this.metric(),
      ageRangeMonths(this.ageRange()),
    );
  }

  downloadChart() {
    const child = this.child();
    const ageRange = this.ageRange();
    const range = ageRangeMonths(ageRange);
    const png = renderGrowthChartPng(
      buildGrowthChartData(child, ageRange, range, this.metric(), 'light'),
      range,
      `${child?.name ?? ''} ${child?.lastName ?? ''} – ${metricLabel(this.metric())}, ${ageRange}–${ageRange + 1} Jahre`,
    );
    downloadDataUrl(
      png,
      `${child?.name || '?'}-${child?.lastName || '?'}-${this.metric() === 'weight' ? 'Gewicht' : 'Groesse'}-${ageRange}-${ageRange + 1}.png`,
    );
  }

  openFullscreen() {
    const modalRef = this.modalService.open(
      GrowthChartFullscreenModalComponent,
      { fullscreen: true },
    );
    modalRef.componentInstance.child = this.child();
    modalRef.componentInstance.metric = this.metric();
    modalRef.componentInstance.ageRange = this.ageRange();
  }
}
