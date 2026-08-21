import {
  Component,
  inject,
  computed,
  model,
  effect,
  signal,
} from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FullOrganisation } from '../../../../../shared/types';
import { OrgSelectComponent } from 'src/app/components/org-select/org-select';
import { StatsChartCardComponent } from '../../components/stats/stats-chart-card/stats-chart-card.component';
import { StatsService } from 'src/app/services/stats.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { StatsCountCasesCard } from 'src/app/components/stats/stats-count-cases-card/stats-count-cases-card.component';
import { StatsContactCard } from 'src/app/components/stats/stats-contacts-card/stats-contacts-card.component';
import { StatsCardDynamicComponent } from 'src/app/components/stats/stats-card-dynamic/stats-card-dynamic.component';
import { StatsDashboardStateService } from 'src/app/services/stats-dashoard-state.service';
import { endOfDay, formatISO, isAfter, parseISO, startOfDay } from 'date-fns';
import { csvFilename, downloadCsv } from 'src/app/util/csvExport';
import { downloadJson, jsonFilename, toJson } from 'src/app/util/jsonExport';
import {
  downloadXlsx,
  toXlsxBlob,
  XlsxColumn,
  xlsxFilename,
} from 'src/app/util/xlsxExport';

@Component({
  selector: 'app-stats-dashboard',
  standalone: true,
  imports: [
    AsyncPipe,
    CommonModule,
    FormsModule,
    OrgSelectComponent,
    StatsChartCardComponent,
    StatsCardDynamicComponent,
    StatsCountCasesCard,
    StatsContactCard,
    StatsCardDynamicComponent,
  ],
  templateUrl: './stats-dashboard.page.html',
  styleUrls: ['./stats-dashboard.page.scss'],
})
export class StatsDashboardPage {
  private statsService = inject(StatsService);
  private stateService = inject(StatsDashboardStateService);

  dateFrom = signal(
    this.stateService.state.range.start.toISOString().slice(0, 10),
  );

  dateTo = signal(this.stateService.state.range.end.toISOString().slice(0, 10));

  selectedOrg = signal<FullOrganisation | undefined>(undefined);

  dateFromChange(e: Event) {
    const start = parseISO((e.target as HTMLInputElement).value);
    if (isAfter(start, new Date(9999, 11, 31)) || isNaN(start.valueOf()))
      this.dateFrom.set(
        formatISO(new Date(9999, 11, 31), { representation: 'date' }),
      );
    else this.dateFrom.set((e.target as HTMLInputElement).value);
  }
  dateToChange(e: Event) {
    const start = parseISO((e.target as HTMLInputElement).value);
    if (isAfter(start, new Date(9999, 11, 31)) || isNaN(start.valueOf()))
      this.dateTo.set(
        formatISO(new Date(9999, 11, 31), { representation: 'date' }),
      );
    else this.dateTo.set((e.target as HTMLInputElement).value);
  }

  range = computed(() => {
    return {
      start: startOfDay(new Date(this.dateFrom())),
      end: endOfDay(new Date(this.dateTo())),
    };
  });

  city = model(this.stateService.state.city);
  availableCities = toSignal(this.statsService.getCities());

  plz = model(this.stateService.state.plz);

  filter = computed(() =>
    this.statsService.makeCaseFilter({
      city: this.city(),
      plz: this.plz(),
      orgId: this.selectedOrg()?.id,
    }),
  );

  caseCount$ = computed(() =>
    this.statsService.countCases(this.filter(), this.range()),
  );

  docs$ = computed(() =>
    this.statsService.getContactStats(this.filter(), {
      date: { gte: this.range().start, lte: this.range().end },
    }),
  );

  constructor() {
    effect(() => {
      this.stateService.updateState({
        range: this.range(),
        city: this.city(),
        plz: this.plz(),
      });
    });
  }

  exportCsv() {
    const regionLabel = this.city() || 'Alle Orte';
    const plzLabel = this.plz() || 'Alle PLZ';
    const rangeLabel = `${this.dateFrom() || '–'} bis ${this.dateTo() || '–'}`;

    const rows: string[][] = [
      ['Ort/Region', regionLabel],
      ['PLZ', plzLabel],
      ['Zeitraum', rangeLabel],
      [],
      ['Kennzahl', 'Wert'],
    ];

    const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const csv = rows
      .map((row) => row.map((col) => escape(col ?? '')).join(';'))
      .join('\r\n');

    downloadCsv(csvFilename('famdoc_stats'), csv);
  }

  exportJson() {
    const regionLabel = this.city() || 'Alle Orte';
    const plzLabel = this.plz() || 'Alle PLZ';
    const rangeLabel = `${this.dateFrom() || '–'} bis ${this.dateTo() || '–'}`;

    const data = {
      'Ort/Region': regionLabel,
      PLZ: plzLabel,
      Zeitraum: rangeLabel,
    };

    downloadJson(jsonFilename('famdoc_stats'), toJson([data]));
  }

  async exportXlsx(): Promise<void> {
    const columns: XlsxColumn<{ field: string; value: string }>[] = [
      { header: 'Feld', value: (r) => r.field },
      { header: 'Wert', value: (r) => r.value },
    ];
    const rows = [
      { field: 'Ort/Region', value: this.city() || 'Alle Orte' },
      { field: 'PLZ', value: this.plz() || 'Alle PLZ' },
      {
        field: 'Zeitraum',
        value: `${this.dateFrom() || '–'} bis ${this.dateTo() || '–'}`,
      },
    ];

    downloadXlsx(
      xlsxFilename('famdoc_stats'),
      await toXlsxBlob(rows, columns),
    );
  }
}
