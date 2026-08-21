import { inject, Injectable } from '@angular/core';
import { Subject, zip } from 'rxjs';
import { ChartKey } from './stats-chart-card.component';
import { StatsService } from 'src/app/services/stats.service';
import { sortByNumProperty } from 'src/app/util/generalUtils';
import { ContactDocumentationOptions } from '../../../../../../shared/sharedGlobals';
import { CaseWhereInput } from '../../../../../../shared/generated/prisma/models';

@Injectable({
  providedIn: 'root',
})
export class ChartsService {
  private statsService = inject(StatsService);

  public data = new Subject<number[]>();
  public labels = new Subject<string[]>();

  updateData(
    chartKey: ChartKey,
    filter: CaseWhereInput = {},
    range: { start: Date; end: Date },
  ) {
    switch (chartKey) {
      case 'artDerBeratung':
        this.statsService
          .getContactStats(filter || {}, {
            date: { gte: range.start, lte: range.end },
          })
          .subscribe((contacts) => {
            let data = [0, 0, 0, 0, 0, 0, 0];
            contacts.forEach((contact) => {
              if (contact.artDerBetreuung === null) return;
              data[contact.artDerBetreuung] += 1;
            });
            this.data.next(data);
            this.labels.next(
              ContactDocumentationOptions['artDerBetreuung']
                .sort(sortByNumProperty('id'))
                .map((v) => v.text),
            );
          });
        break;
      case 'ziel':
        this.statsService.getAnonCases(filter, range).subscribe((cases) => {
          let data = [0, 0, 0];
          cases.forEach((c) => {
            c.zielvereinbarungen.forEach((z) => {
              switch (z.status) {
                case 'inProgress':
                  data[0] += 1;
                  break;
                case 'done':
                  data[1] += 1;
                  break;
                case 'failed':
                  data[2] += 1;
                  break;
              }
            });
          });
          this.data.next(data);
          this.labels.next(['In Arbeit', 'Abgeschlossen', 'Fehlgeschlagen']);
        });
        break;
      case 'ort':
        zip(
          this.statsService.getCities(),
          this.statsService.getAnonCases(filter, range),
        ).subscribe(([cities, cases]) => {
          let data: number[] = new Array(cities.length).fill(0);
          cases.forEach((c) => {
            const cIndex = cities.findIndex((city) => c.city === city);
            data[cIndex] += 1;
          });
          this.data.next(data);
          this.labels.next(cities);
        });
        break;
    }
  }
}
