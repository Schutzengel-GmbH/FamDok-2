import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  FamilyDetailComponent,
  TAB_KEYS,
  TabKey,
} from 'src/app/components/family-detail/family-detail.component';
import { CaseService } from 'src/app/services/case.service';
import { MeService } from 'src/app/services/me.service';
import { ToastService } from 'src/app/services/toast.service';
import { userCanEditCase } from 'src/app/util/generalUtils';
import { FullCase, FullUser } from '../../../../../shared/types';

/**
 * Route-level wrapper around `app-family-detail`: resolves the case (and the current tab) from
 * the URL and loads the case, so the detail view - the former family-detail-modal - is a normal,
 * URL-addressable page instead of dialog state kept in the list/dashboard that opened it.
 */
@Component({
  selector: 'app-family-detail-page',
  standalone: true,
  imports: [FamilyDetailComponent, RouterLink],
  templateUrl: './family-detail.page.html',
  styleUrl: './family-detail.page.scss',
})
export class FamilyDetailPage {
  private activatedRoute = inject(ActivatedRoute);
  private caseService = inject(CaseService);
  private meService = inject(MeService);
  private toastService = inject(ToastService);

  protected caseId = this.activatedRoute.snapshot.paramMap.get('caseId')!;

  private tabParam = this.activatedRoute.snapshot.paramMap.get(
    'tab',
  ) as TabKey | null;
  protected initialTab = TAB_KEYS.includes(this.tabParam as TabKey)
    ? (this.tabParam as TabKey)
    : undefined;

  protected selectedCase = signal<FullCase | undefined>(undefined);
  protected isLoading = signal(true);
  private currentUser = signal<FullUser | undefined>(undefined);

  protected readOnly = computed(
    () => !userCanEditCase(this.currentUser(), this.selectedCase()),
  );

  constructor() {
    this.meService.getMe().subscribe((user) => this.currentUser.set(user));

    this.caseService.getCase(this.caseId).subscribe({
      next: (c) => {
        this.selectedCase.set(c);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.toastService.show({
          title: 'Fehler',
          text:
            'Der Fall konnte nicht geladen werden: ' +
            (error?.message ?? error),
          severity: 'danger',
        });
      },
    });
  }
}
