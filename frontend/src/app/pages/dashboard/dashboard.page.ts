import { Component, inject, model, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardFamilyTableComponent } from 'src/app/components/dashboard-family-table/dashboard-family-table.component';
import { FachkraftKpiRowComponent } from 'src/app/components/fachkraft-kpi-row/fachkraft-kpi-row.component';
import { WarningsListComponent } from 'src/app/components/warnings-list/warnings-list.component';
import { FullCase } from '../../../../../shared/types';
import { DashboardCasesService } from 'src/app/services/dashboard-cases.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    DashboardFamilyTableComponent,
    FachkraftKpiRowComponent,
    WarningsListComponent,
  ],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage {
  @ViewChild('familyTable') familyTable!: DashboardFamilyTableComponent;
  @ViewChild('warningsList') warningsList!: WarningsListComponent;

  protected dashboardCases = inject(DashboardCasesService);

  search = model<string>();

  get myCases(): FullCase[] {
    return this.dashboardCases.cases();
  }

  onOpenZielvereinbarung(caseId: string): void {
    this.familyTable?.openCaseById(caseId, 'zielvereinbarungen');
  }

  onDetailsClosed(): void {
    this.dashboardCases.reload();
    this.warningsList?.refresh();
  }
}
