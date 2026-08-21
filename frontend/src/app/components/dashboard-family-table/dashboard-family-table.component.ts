import {
  Component,
  OnInit,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FullCase } from '../../../../../shared/types';
import {
  FamilyDetailModalComponent,
  TabKey,
} from '../family-detail-modal/family-detail-modal.component';
import {
  userArrayPipe,
  familyNamePipe,
} from 'src/app/util/tableTransformPipes';
import { DashboardCasesService } from 'src/app/services/dashboard-cases.service';
import { MeService } from 'src/app/services/me.service';
import { FullUser } from '../../../../../shared/types';
import { Role } from '../../../../../shared/generated/prisma/enums';

type ZielStatusKind = 'green' | 'yellow' | 'red' | 'gray';

@Component({
  selector: 'app-dashboard-family-table',
  standalone: true,
  imports: [CommonModule, FormsModule, FamilyDetailModalComponent],
  templateUrl: './dashboard-family-table.component.html',
  styleUrls: ['./dashboard-family-table.component.scss'],
})
export class DashboardFamilyTableComponent implements OnInit {
  private dashboardCases = inject(DashboardCasesService);
  private meService = inject(MeService);

  protected currentUser: FullUser | undefined;
  protected modalReadOnly = false;

  protected rows = linkedSignal(() =>
    this.dashboardCases.cases().filter((c) =>
      this.filterTerm()
        ? c.family.name
            .toLowerCase()
            .includes(this.filterTerm()!.toLowerCase()) ||
          c.family.note
            ?.toLowerCase()
            .includes(this.filterTerm()!.toLowerCase())
        : true,
    ),
  );
  filterTerm = input<string>();

  protected selectedCase!: FullCase | undefined;
  changeSelectedCase = output<FullCase>();

  /** Emitted whenever the detail modal closes, e.g. so warnings can be re-fetched after an edit. */
  detailsClosed = output<void>();

  isDetailModalOpen = signal(false);
  protected modalInitialTab: TabKey = 'stammdaten';

  protected userArrayPipe = userArrayPipe;
  protected familyNamePipe = familyNamePipe;

  ngOnInit() {
    this.dashboardCases.reload();
    this.meService.getMe().subscribe((user) => (this.currentUser = user));
  }

  /** Whether the current user could actually save changes to this case - matches the
   * backend's canEditCase (Admin, or one of the case's responsibleUsers). */
  canEditCase(row: FullCase): boolean {
    const user = this.currentUser;
    if (!user) return false;
    if (user.role === Role.Admin) return true;
    return row.responsibleUsers.some((ru) => ru.id === user.id);
  }

  selectCase(row: FullCase): void {
    this.selectedCase = row;
    this.changeSelectedCase.emit(row);
  }

  openDetails(row: FullCase, tab: TabKey = 'stammdaten'): void {
    this.selectCase(row);
    this.modalInitialTab = tab;
    this.modalReadOnly = !this.canEditCase(row);
    this.isDetailModalOpen.set(true);
  }

  /** Opens the detail modal for a case that isn't necessarily part of the current filter, e.g. from a warning link. */
  openCaseById(caseId: string, tab: TabKey = 'stammdaten'): void {
    const row = this.dashboardCases.cases().find((c) => c.id === caseId);
    if (!row) return;
    this.openDetails(row, tab);
  }

  closeDetails(): void {
    this.dashboardCases.reload();
    this.isDetailModalOpen.set(false);
    this.modalInitialTab = 'stammdaten';
    this.detailsClosed.emit();
  }

  getZielStatusClass(row: FullCase): string {
    const kind = this.getRowZielStatusKind(row);

    if (kind === 'green') return 'status-dot--green';
    if (kind === 'yellow') return 'status-dot--yellow';
    if (kind === 'red') return 'status-dot--red';

    return '';
  }

  getZielStatusText(row: FullCase): string {
    const kind = this.getRowZielStatusKind(row);

    if (kind === 'green') return 'Abgeschlossen';
    if (kind === 'yellow') return 'In Arbeit';
    if (kind === 'red') return 'Handlungsbedarf';

    return 'Keine Zielvereinbarung';
  }

  private getRowZielStatusKind(row: FullCase): ZielStatusKind {
    const statuses = (row.zielvereinbarungen ?? [])
      .map((z) => this.normalizeZielStatus((z as any).status))
      .filter((s): s is Exclude<ZielStatusKind, 'gray'> => s !== 'gray');

    if (statuses.length === 0) {
      return 'gray';
    }

    if (statuses.every((s) => s === 'green')) {
      return 'green';
    }

    if (statuses.every((s) => s === 'red')) {
      return 'red';
    }

    if (statuses.some((s) => s === 'yellow')) {
      return 'yellow';
    }

    if (statuses.some((s) => s === 'red')) {
      return 'red';
    }

    if (statuses.some((s) => s === 'green')) {
      return 'yellow';
    }

    return 'gray';
  }

  private normalizeZielStatus(statusRaw: unknown): ZielStatusKind {
    const s = String(statusRaw ?? '')
      .trim()
      .toLowerCase();

    if (!s) return 'gray';

    if (
      [
        'kritisch',
        'overdue',
        'abgebrochen',
        'fehlgeschlagen',
        'failed',
        'red',
      ].some((k) => s.includes(k))
    ) {
      return 'red';
    }

    if (
      [
        'offen',
        'in arbeit',
        'inarbeit',
        'pending',
        'open',
        'yellow',
        'inprogress',
      ].some((k) => s.includes(k))
    ) {
      return 'yellow';
    }

    if (
      ['erledigt', 'done', 'abgeschlossen', 'green'].some((k) => s.includes(k))
    ) {
      return 'green';
    }

    return 'gray';
  }

  getLatestContactText(row: FullCase): string {
    const latest = row.contactDocumentation?.[0];
    if (!latest) return 'Kein Kontakt dokumentiert';
    if (!latest.date) return 'Datum unbekannt';
    return new Date(latest.date).toLocaleDateString('de-DE');
  }

  getChildrenCount(row: FullCase): number {
    return row.family?.children?.length ?? 0;
  }
}
