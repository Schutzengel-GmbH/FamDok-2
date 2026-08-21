import { computed, inject, Injectable, signal } from '@angular/core';
import { CaseService } from './case.service';
import { MeService } from './me.service';
import { FullCase } from '../../../../shared/types';
import { Role } from '../../../../shared/generated/prisma/enums';
import { CaseInclude } from '../../../../shared/generated/prisma/models';

export type MyCasesScope = 'own' | 'org' | 'subOrg';

const CASES_INCLUDE: CaseInclude = {
  contactDocumentation: {
    orderBy: { date: { sort: 'desc', nulls: 'last' } },
    take: 1,
  },
};

/**
 * Single shared source for the dashboard's "my cases" list, used by both dashboard variants
 * (and their case-table child components) so the own-vs-org scope toggle only needs to be
 * implemented once, instead of being wired into every component that independently fetched
 * `/case/my` before.
 */
@Injectable({ providedIn: 'root' })
export class DashboardCasesService {
  private caseService = inject(CaseService);
  private meService = inject(MeService);

  private readonly role = signal<Role | undefined>(undefined);

  readonly scope = signal<MyCasesScope>('own');
  readonly cases = signal<FullCase[]>([]);

  /** Which scopes the current user may pick, beyond the always-available 'own'. */
  readonly availableScopes = computed<MyCasesScope[]>(() => {
    if (this.role() === Role.OrgCoordinator) return ['own', 'org'];
    if (this.role() === Role.SubOrgCoordinator) return ['own', 'subOrg'];
    return ['own'];
  });

  constructor() {
    this.meService.getMe().subscribe((me) => this.role.set(me.role));
  }

  setScope(scope: MyCasesScope) {
    if (scope === this.scope()) return;
    this.scope.set(scope);
    this.reload();
  }

  reload(): void {
    this.caseService
      .getMyCases({ include: CASES_INCLUDE, scope: this.scope() })
      .subscribe({
        next: (cases) => this.cases.set(cases ?? []),
        error: (error) => {
          console.error('Fehler beim Laden der Fälle:', error);
          this.cases.set([]);
        },
      });
  }
}
