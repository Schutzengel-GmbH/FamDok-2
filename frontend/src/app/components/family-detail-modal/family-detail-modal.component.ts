import { CommonModule } from '@angular/common';
import {
  Component,
  signal,
  computed,
  inject,
  output,
  input,
  model,
  linkedSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FullCase } from '../../../../../shared/types';
import {
  userArrayPipe,
  familyNamePipe,
  countChildrenPipe,
} from 'src/app/util/tableTransformPipes';
import { ToastService } from 'src/app/services/toast.service';
import { TabStammdatenComponent } from './tab-stammdaten/tab-stammdaten.component';
import { TabDatenblaetterComponent } from './tab-datenblaetter/tab-datenblaetter.component';
import { TabFreieDokumentationComponent } from './tab-freie-dokumentation/tab-freie-dokumentation.component';
import { TabZielvereinbarungenComponent } from './tab-zielvereinbarungen/tab-zielvereinbarungen.component';
import { TabSonstigeFormulareComponent } from './tab-sonstige-formulare/tab-formulare.component';
import { TabFamilienbetreuerComponent } from './tab-familienbetreuer/tab-familienbetreuer.component';
import { TabClose } from './tab-close/tab-close.component';
import { TabAnhaengeComponent } from './tab-anhaenge/tab-anhaenge.component';
import { CaseService } from 'src/app/services/case.service';

export type TabKey =
  | 'stammdaten'
  | 'zielvereinbarungen'
  | 'formulare'
  | 'freie-dokumentation'
  | 'fachkraft'
  | 'datenblaetter'
  | 'anhaenge'
  | 'close';

type ZielStatusKind = 'green' | 'yellow' | 'red' | 'gray';

type ZielItem = {
  id: string;
  topic: string;
  description: string;
  targetDate?: Date;
  status: string;
};

@Component({
  selector: 'app-family-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TabStammdatenComponent,
    TabFamilienbetreuerComponent,
    TabDatenblaetterComponent,
    TabFreieDokumentationComponent,
    TabZielvereinbarungenComponent,
    TabSonstigeFormulareComponent,
    TabAnhaengeComponent,
    TabClose,
  ],
  templateUrl: './family-detail-modal.component.html',
  styleUrls: ['./family-detail-modal.component.scss'],
})
export class FamilyDetailModalComponent {
  isOpen = model.required<boolean>();
  selectedCase = model<FullCase | undefined>(undefined);
  initialTab = input<TabKey | undefined>(undefined);
  /** Whether the current user can actually write to the selected case - if not, every tab
   * hides its mutating actions (edit/add/delete/handover/close) and shows a plain view. */
  readOnly = input(false);

  closed = output<void>();
  caseUpdated = output<FullCase>();

  private caseService = inject(CaseService);
  private toastService = inject(ToastService);

  protected familyNamePipe = familyNamePipe;
  protected userArrayPipe = userArrayPipe;
  protected countChildrenPipe = countChildrenPipe;

  protected activeTab = linkedSignal<TabKey>(() => {
    const tab = this.initialTab() || 'stammdaten';
    // "Sonstige Formulare" only ever creates a new response - nothing to view read-only, so
    // it's not offered at all when the user can't write to this case.
    return tab === 'formulare' && this.readOnly() ? 'stammdaten' : tab;
  });
  protected selectedChildId = signal<string | undefined>(undefined);

  protected selectedChild = computed(() => {
    const id = this.selectedChildId();
    const c = this.selectedCase();

    if (!c || !id) {
      return undefined;
    }

    return c.family.children.find((x) => x.id === id);
  });

  protected zielList = signal<ZielItem[]>([]);
  protected zielFormOpen = signal<boolean>(false);
  protected zielEditingId = signal<string | null>(null);

  protected zielTopic = signal<string>('');
  protected zielDescription = signal<string>('');
  protected zielTargetDate = signal<string>('');

  private seededCaseId: string | null = null;

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);

    if (tab === 'zielvereinbarungen') {
      this.seedZieleFromCase(true);
    }
  }

  close(): void {
    this.isOpen.set(false);
    this.activeTab.set('stammdaten');
    this.selectedChildId.set(undefined);
    this.zielFormOpen.set(false);
    this.zielEditingId.set(null);
    this.resetZielForm();
    this.closed.emit();
  }

  getAdressString(adress: PrismaJson.Address | null | undefined): string {
    if (!adress) {
      return 'Keine Adresse hinterlegt';
    }

    return `${adress.street} ${adress.number}, ${adress.plz} ${adress.city}`;
  }

  formatDateInput(d?: Date): string {
    if (!d) {
      return '';
    }

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${y}-${m}-${day}`;
  }

  formatDateDisplay(d?: Date): string {
    if (!d) {
      return '';
    }

    return d.toLocaleDateString('de-DE');
  }

  openZielFormNew(): void {
    this.zielEditingId.set(null);
    this.resetZielForm();
    this.zielFormOpen.set(true);
  }

  zielStatusKind(statusRaw: string): ZielStatusKind {
    const s = String(statusRaw ?? '')
      .trim()
      .toLowerCase();

    if (!s) {
      return 'gray';
    }

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

  zielDotClass(statusRaw: string): string {
    const k = this.zielStatusKind(statusRaw);

    if (k === 'green') {
      return 'status-dot status-dot--green';
    }

    if (k === 'yellow') {
      return 'status-dot status-dot--yellow';
    }

    if (k === 'red') {
      return 'status-dot status-dot--red';
    }

    return 'status-dot';
  }

  zielBadgeClass(statusRaw: string): string {
    const k = this.zielStatusKind(statusRaw);

    if (k === 'green') {
      return 'badge-soft badge-soft--green';
    }

    if (k === 'yellow') {
      return 'badge-soft badge-soft--yellow';
    }

    if (k === 'red') {
      return 'badge-soft badge-soft--red';
    }

    return 'badge-soft';
  }

  private resetZielForm(): void {
    this.zielTopic.set('');
    this.zielDescription.set('');
    this.zielTargetDate.set('');
  }

  responsibleUsersChanged(removedUser: boolean) {
    if (!removedUser) this.refreshCaseFromBackend('fachkraft');
    else this.close();
  }

  refreshCaseFromBackend(targetTab?: TabKey): void {
    if (!this.selectedCase()?.id) {
      return;
    }

    this.caseService.getCase(this.selectedCase()!.id).subscribe({
      next: (updatedCase) => {
        this.selectedCase.set(updatedCase);
        this.seededCaseId = null;
        this.seedZieleFromCase(true);

        if (targetTab) {
          this.activeTab.set(targetTab);
        }

        if (
          this.activeTab() === 'stammdaten' &&
          updatedCase.family.children?.length &&
          !this.selectedChildId()
        ) {
          this.selectedChildId.set(updatedCase.family.children[0].id);
        }

        this.caseUpdated.emit(updatedCase);
      },
      error: (error) => {
        this.toastService.show({
          title: 'Fehler',
          text:
            'Der Fall konnte nicht neu geladen werden: ' +
            (error?.message ?? error),
          severity: 'danger',
        });
      },
    });
  }

  private seedZieleFromCase(force = false): void {
    const c: any = this.selectedCase();
    const caseId = String(c?.id ?? '');

    if (!caseId) {
      return;
    }

    if (!force && this.seededCaseId === caseId) {
      return;
    }

    const items = (c?.zielvereinbarungen ?? []) as any[];

    const mapped: ZielItem[] = items.map((z: any) => ({
      id: String(z.id ?? `${z.topic}-${z.status}-${z.description}`),
      topic: String(z.topic ?? ''),
      description: String(z.description ?? ''),
      targetDate: z.targetDate
        ? new Date(z.targetDate)
        : z.dueDate
          ? new Date(z.dueDate)
          : z.finishBy
            ? new Date(z.finishBy)
            : undefined,
      status: String(z.status ?? 'offen'),
    }));

    this.zielList.set(mapped);
    this.seededCaseId = caseId;
  }
}
