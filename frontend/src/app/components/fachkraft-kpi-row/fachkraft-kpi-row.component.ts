import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FullCase } from '../../../../../shared/types';
import { Status } from '../../../../../shared/generated/prisma/enums';

interface FachkraftKpiCard {
  label: string;
  value: number;
  subline: string;
  icon: string;
}

@Component({
  selector: 'app-fachkraft-kpi-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fachkraft-kpi-row.component.html',
  styleUrls: ['./fachkraft-kpi-row.component.scss'],
})
export class FachkraftKpiRowComponent implements OnChanges {
  @Input({ required: true }) cases: FullCase[] = [];

  protected cards: FachkraftKpiCard[] = [
    {
      label: 'Familien in Betreuung',
      value: 0,
      subline: 'Aktuell zugewiesene Fälle',
      icon: 'bi-people',
    },
    {
      label: 'Offene Zielvereinbarungen',
      value: 0,
      subline: 'Status In Arbeit',
      icon: 'bi-bullseye',
    },
    {
      label: 'Kontakte letzte 30 Tage',
      value: 0,
      subline: 'Mit dokumentiertem Kontakt',
      icon: 'bi-journal-text',
    },
    {
      label: 'Fälle ohne Kontakt',
      value: 0,
      subline: 'Noch keine Dokumentation',
      icon: 'bi-exclamation-circle',
    },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cases']) {
      this.updateCards();
    }
  }

  private updateCards(): void {
    const now = new Date();
    const last30Days = new Date(now);
    last30Days.setDate(now.getDate() - 30);

    const totalCases = this.cases.length;

    const openGoals = this.cases.reduce((sum, c) => {
      const inProgressGoals =
        c.zielvereinbarungen?.filter((z) => z.status === Status.inProgress)
          .length ?? 0;
      return sum + inProgressGoals;
    }, 0);

    const contactsLast30Days = this.cases.filter((c) => {
      const latest = c.contactDocumentation?.[0];
      if (!latest?.date) return false;
      return new Date(latest.date) >= last30Days;
    }).length;

    const casesWithoutContact = this.cases.filter(
      (c) => !c.contactDocumentation || c.contactDocumentation.length === 0,
    ).length;

    this.cards = [
      {
        label: 'Familien in Betreuung',
        value: totalCases,
        subline: 'Aktuell zugewiesene Fälle',
        icon: 'bi-people',
      },
      {
        label: 'Offene Zielvereinbarungen',
        value: openGoals,
        subline: 'Status In Arbeit',
        icon: 'bi-bullseye',
      },
      {
        label: 'Kontakte letzte 30 Tage',
        value: contactsLast30Days,
        subline: 'Mit dokumentiertem Kontakt',
        icon: 'bi-journal-text',
      },
      {
        label: 'Fälle ohne Kontakt',
        value: casesWithoutContact,
        subline: 'Noch keine Dokumentation',
        icon: 'bi-exclamation-circle',
      },
    ];
  }
}
