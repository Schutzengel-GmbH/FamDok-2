import { Component, Input } from '@angular/core';
import { CommonModule, NgForOf, NgIf } from '@angular/common';
import { AnonCase, FullCase } from '../../../../../../shared/types';

@Component({
  selector: 'app-stats-cases-card',
  standalone: true,
  imports: [CommonModule, NgForOf, NgIf],
  templateUrl: './stats-cases-card.component.html',
  styleUrls: ['./stats-cases-card.component.scss'],
})
export class StatsCasesCardComponent {
  @Input() cases: AnonCase[] = [];
}
