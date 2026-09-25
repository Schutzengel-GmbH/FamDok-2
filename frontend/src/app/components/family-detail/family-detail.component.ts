import { CommonModule, Location } from '@angular/common';
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

/** Every valid `TabKey`, in the order the tab bar shows them. Used to validate a tab name that
 * came from the URL before trusting it as the initial tab. */
export const TAB_KEYS: TabKey[] = [
  'stammdaten',
  'zielvereinbarungen',
  'datenblaetter',
  'freie-dokumentation',
  'formulare',
  'anhaenge',
  'fachkraft',
  'close',
];

type ZielStatusKind = 'green' | 'yellow' | 'red' | 'gray';

type ZielItem = {
  id: string;
  topic: string;
  description: string;
  targetDate?: Date;
  status: string;
};

/**
 * Full detail view of a single case, used by the family-detail page. Was a modal dialog until it
 * turned out to be unusable on mobile; it's now rendered directly into the page, so navigating
 * here always keeps the URL - and thus the browser back button and reloads - pinned to the case
 * currently open.
 */
@Component({
  selector: 'app-family-detail',
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
  templateUrl: './family-detail.component.html',
  styleUrls: ['./family-detail.component.scss'],
})
export class FamilyDetailComponent {
  selectedCase = model<FullCase | undefined>(undefined);
  initialTab = input<TabKey | undefined>(undefined);
  /** Whether the current user can actually write to the selected case - if not, every tab
   * hides its mutating actions (edit/add/delete/handover/close) and shows a plain view. */
  readOnly = input(false);

  caseUpdated = output<FullCase>();

  private caseService = inject(CaseService);
  private toastService = inject(ToastService);
  private location = inject(Location);

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

    return c.family?.children.find((x) => x.id === id);
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

  /** Handles the mobile `<select>` tab switcher (the tab bar itself is a plain nav-tabs list,
   * shown instead on wider screens - see detail-tabs__select-wrap in the stylesheet). */
  onTabSelectChange(event: Event): void {
    this.setTab((event.target as HTMLSelectElement).value as TabKey);
  }

  /** Leaves the case, back to wherever it was opened from (family list, dashboard, a warning
   * link, ...). Just browser-back, since the page has no other notion of a "parent" view. */
  goBack(): void {
    this.location.back();
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

  formatDateDisplay(d?: Date | null): string {
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

  /** Reacts to a handover on the Fachkraft tab. If the current user just removed themselves as
   * a responsible person, they may no longer be able to reload or edit this case, so there's
   * nothing useful left to show here - go back instead of refreshing in place. */
  responsibleUsersChanged(removedUser: boolean) {
    if (!removedUser) this.refreshCaseFromBackend('fachkraft');
    else this.goBack();
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
          updatedCase.family?.children?.length &&
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
