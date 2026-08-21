import { Component, input, model } from '@angular/core';

@Component({
  selector: 'app-count-cases-card',
  templateUrl: './stats-count-cases-card.component.html',
  styleUrls: [
    './stats-count-cases-card.component.scss',
    '../stats-card-styles.scss',
  ],
  standalone: true,
})
export class StatsCountCasesCard {
  count = model.required<number>();
}
