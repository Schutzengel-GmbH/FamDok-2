import {
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { FullCase, Warning } from '../../../../../../shared/types';
import { FormType, WarningType } from '../../../../../../shared/consts';
import { map, mergeMap, Subscription } from 'rxjs';
import {
  takeUntilDestroyed,
  toObservable,
  toSignal,
} from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ContactBrief } from '../../contact-brief/contact-brief.component';
import { ContactDocumentationService } from 'src/app/services/contact-documentation.service';
import { WarningsService } from 'src/app/services/warnings.service';
import {
  ContactDocSearchHit,
  MIN_SEARCH_LENGTH,
  searchContactDocumentations,
} from 'src/app/util/contactDocSearch';

/** Which list the tab shows: the latest contacts or the keyword search. */
export type ContactView = 'latest' | 'filter';

@Component({
  selector: 'app-tab-freie-dokumentation',
  standalone: true,
  imports: [ContactBrief],
  templateUrl: './tab-freie-dokumentation.component.html',
})
export class TabFreieDokumentationComponent {
  selectedCase = input.required<FullCase>();
  readOnly = input(false);

  private router = inject(Router);
  private documentationService = inject(ContactDocumentationService);
  private warningsService = inject(WarningsService);
  private destroyRef = inject(DestroyRef);

  readonly minSearchLength = MIN_SEARCH_LENGTH;

  mode = signal<ContactView>('latest');
  /** What is currently typed into the search field; nothing is searched while typing. */
  searchInput = signal('');
  canSearch = computed(
    () => this.searchInput().trim().length >= MIN_SEARCH_LENGTH,
  );
  /** The keyword the shown results belong to; `null` until a search was sent. */
  searchedTerm = signal<string | null>(null);
  searchResults = signal<ContactDocSearchHit[]>([]);
  searching = signal(false);
  searchFailed = signal(false);
  private searchSubscription?: Subscription;

  constructor() {
    // Results belong to one case: drop them when another case is shown.
    toObservable(this.selectedCase)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.resetSearch());
  }

  latestDocs = toSignal(
    toObservable(this.selectedCase).pipe(
      mergeMap((c) =>
        this.documentationService.getLatestDocumentationForCase(c.id, 5),
      ),
    ),
  );

  private warnings = toSignal(this.warningsService.getWarnings(), {
    initialValue: [] as Warning[],
  });

  private unfinishedContactDocIds = computed(() => {
    const caseId = this.selectedCase().id;
    return new Set(
      this.warnings()
        .filter(
          (w): w is Extract<Warning, { type: WarningType.UNFINISHED_FORM }> =>
            w.type === WarningType.UNFINISHED_FORM,
        )
        .filter(
          (w) =>
            w.data.caseId === caseId && w.data.formType === FormType.CONTACT_DOC,
        )
        .map((w) => w.data.responseId),
    );
  });

  hasWarning(docId: string): boolean {
    return this.unfinishedContactDocIds().has(docId);
  }

  onSearchInput(event: Event) {
    this.searchInput.set((event.target as HTMLInputElement).value);
  }

  /**
   * Loads all contacts of the case and filters them in the browser: in encrypted organisations
   * summary and documentation can only be read after decryption.
   */
  search(event?: Event) {
    event?.preventDefault();
    if (!this.canSearch()) return;
    const term = this.searchInput().trim();
    this.searchSubscription?.unsubscribe();
    this.searching.set(true);
    this.searchFailed.set(false);
    this.searchSubscription = this.documentationService
      .getDocumentationForCase(this.selectedCase().id)
      .pipe(
        map((docs) => searchContactDocumentations(docs, term)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (hits) => {
          this.searchResults.set(hits);
          this.searchedTerm.set(term);
          this.searching.set(false);
        },
        error: () => {
          this.searchResults.set([]);
          this.searchedTerm.set(null);
          this.searchFailed.set(true);
          this.searching.set(false);
        },
      });
  }

  private resetSearch() {
    this.searchSubscription?.unsubscribe();
    this.searchResults.set([]);
    this.searchedTerm.set(null);
    this.searching.set(false);
    this.searchFailed.set(false);
  }

  addContact() {
    if (this.readOnly()) return;
    this.router.navigate(['contact-documentation', this.selectedCase().id]);
  }
}
