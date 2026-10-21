import { Component, computed, inject, ViewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ChartData, ChartOptions } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { BaseChartDirective } from 'ng2-charts';
import { ThemeService } from 'src/app/services/theme.service';
import { ageRangeMonths, GrowthMetric } from 'src/app/util/healthDataUtils';
import { ChildModel as Child } from '../../../../../../shared/generated/prisma/models';
import {
  buildGrowthChartData,
  buildGrowthChartOptions,
  downloadDataUrl,
  metricLabel,
  MonthRange,
  renderGrowthChartPng,
} from '../growth-chart.config';

const FULL_RANGE = ageRangeMonths('all');

@Component({
  selector: 'app-growth-chart-fullscreen-modal',
  imports: [BaseChartDirective],
  standalone: true,
  templateUrl: './growth-chart-fullscreen-modal.component.html',
  // ngb renders this host between .modal-content and header/body - make it pass the
  // full height on so the chart can fill the screen
  host: { class: 'd-flex flex-column h-100' },
})
export class GrowthChartFullscreenModalComponent {
  activeModal = inject(NgbActiveModal);
  private theme = toSignal(inject(ThemeService).theme, { requireSync: true });

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  // set by the opener via componentInstance before the first change detection
  child?: Child;
  metric: GrowthMetric = 'weight';
  ageRange: 0 | 1 | 2 = 0;

  // registered per chart so the inline charts stay non-zoomable
  protected plugins = [zoomPlugin];

  // the whole 0-3 years is plotted, the view starts on the selected age range
  data = computed<ChartData>(() =>
    buildGrowthChartData(
      this.child,
      'all',
      FULL_RANGE,
      this.metric,
      this.theme(),
    ),
  );

  options = computed<ChartOptions>(() => {
    const options = buildGrowthChartOptions(ageRangeMonths(this.ageRange));
    return {
      ...options,
      maintainAspectRatio: false,
      plugins: {
        ...options.plugins,
        zoom: {
          pan: { enabled: true, mode: 'xy' },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'xy',
          },
          limits: {
            x: { min: FULL_RANGE.min, max: FULL_RANGE.max, minRange: 1 },
            y: { ...this.yBounds(), minRange: 0.5 },
          },
        },
      },
    };
  });

  get title() {
    return `${this.child?.name ?? ''} ${this.child?.lastName ?? ''} – ${metricLabel(this.metric)}`;
  }

  resetZoom() {
    this.chart?.chart?.resetZoom();
  }

  downloadChart() {
    const range = this.visibleRange();
    const png = renderGrowthChartPng(
      buildGrowthChartData(
        this.child,
        'all',
        FULL_RANGE,
        this.metric,
        'light',
      ),
      range,
      `${this.title}, ${range.min}–${range.max} Monate`,
    );
    downloadDataUrl(
      png,
      `${this.child?.name || '?'}-${this.child?.lastName || '?'}-${this.metric === 'weight' ? 'Gewicht' : 'Groesse'}-${range.min}-${range.max}-Monate.png`,
    );
  }

  /** The x window currently shown, widened to whole months */
  visibleRange(): MonthRange {
    const x = this.chart?.chart?.scales['x'];
    if (!x) return ageRangeMonths(this.ageRange);
    return {
      min: Math.max(FULL_RANGE.min, Math.floor(x.min)),
      max: Math.min(FULL_RANGE.max, Math.ceil(x.max)),
    };
  }

  // keep panning/zooming within the plotted values instead of empty space
  private yBounds() {
    const ys = this.data().datasets.flatMap((d) =>
      (d.data as { y: number }[]).map((p) => p.y),
    );
    if (ys.length === 0) return {};
    const min = Math.min(...ys);
    const max = Math.max(...ys);
    const padding = (max - min) * 0.05;
    return { min: Math.floor(min - padding), max: Math.ceil(max + padding) };
  }
}
