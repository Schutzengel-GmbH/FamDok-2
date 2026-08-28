import {
  Component,
  HostBinding,
  HostListener,
  Input,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { FullCase, FullFamily, FullUser } from '../../../../../shared/types';
import {
  ColumnMode,
  DataTableColumnCellDirective,
  DataTableColumnHeaderDirective,
  DatatableComponent,
  DatatableRowDetailDirective,
  DatatableRowDetailTemplateDirective,
  NgxDatatableModule,
} from '@swimlane/ngx-datatable';
import { Router, RouterLink } from '@angular/router';
import { MeService } from 'src/app/services/me.service';
import { FormsModule } from '@angular/forms';
import {
  FamilyDetailModalComponent,
  TabKey,
} from '../family-detail-modal/family-detail-modal.component';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Role } from '../../../../../shared/generated/prisma/enums';
import { ChildModel as Child } from '../../../../../shared/generated/prisma/models';
import { CaseService } from 'src/app/services/case.service';
import { sortCasesByFamilyName } from 'src/app/util/generalUtils';

@Component({
  imports: [
    NgxDatatableModule,
    DatatableComponent,
    DatatableRowDetailDirective,
    DatatableRowDetailTemplateDirective,
    DataTableColumnCellDirective,
    DataTableColumnHeaderDirective,
    FormsModule,
    FamilyDetailModalComponent,
    NgbTooltip,
    RouterLink,
  ],
  selector: 'app-family-list',
  templateUrl: './family-list.component.html',
  styleUrls: ['./family-list.component.scss'],
  standalone: true,
})
export class Families implements OnInit {
  @Input({ required: false }) small!: boolean;

  @HostBinding('class.is-small')
  get isSmall(): boolean {
    return !!this.small;
  }

  @ViewChild('caseTable') table!: DatatableComponent<FullCase>;

  private caseService = inject(CaseService);
  private meService = inject(MeService);
  private router = inject(Router);

  protected currentUser: FullUser | undefined;

  protected ColumnMode = ColumnMode;
  protected isMobileTable = false;

  protected allCases: FullCase[] = [];
  protected pagedCases: FullCase[] = [];

  protected pageSize = 10;
  protected currentPage = 1;
  protected totalCount = 0;
  protected totalPages = 1;

  protected familyNamePipe = {
    transform(family: FullFamily | null | undefined) {
      if (!family) return 'Familie (Daten gelöscht)';
      return `Familie ${family.name}`;
    },
  };

  protected userArrayPipe = {
    transform(users: FullUser[]) {
      return users.reduce(
        (prev, cur, i) =>
          prev +
          `${i === 0 ? `${cur.firstName} ${cur.lastName}` : `, ${cur.firstName} ${cur.lastName}`}`,
        '',
      );
    },
  };

  protected countChildrenPipe = {
    transform(children: Child[] | undefined) {
      return children?.length ?? 0;
    },
  };

  ngOnInit(): void {
    this.pageSize = this.small ? 5 : 10;
    this.updateMobileTableMode();

    this.fetchData();
  }

  fetchData() {
    this.meService.getMe().subscribe((user) => {
      this.currentUser = user;

      // OrgCoordinator/SubOrgCoordinator see every family in their org/suborg that currently
      // has an active (not yet closed) case - not just the cases they're responsible for.
      const source$ =
        user.role === Role.Admin
          ? this.caseService.getCases()
          : user.role === Role.OrgCoordinator
            ? this.caseService.getCases({
                organisation: { id: user.organisationId! },
                closedAt: null,
              })
            : user.role === Role.SubOrgCoordinator
              ? this.caseService.getCases({
                  subOrganisationId: {
                    in: user.subOrganisations.map((so) => so.id),
                  },
                  closedAt: null,
                })
              : this.caseService.getCasesForUser(this.meService.getKCId()!);

      source$.subscribe((cases) => {
        this.allCases = cases.sort(sortCasesByFamilyName) ?? [];
        this.totalCount = this.allCases.length;
        this.currentPage = 1;
        this.updatePagedCases();
      });
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    const oldMode = this.isMobileTable;
    this.updateMobileTableMode();

    if (this.table && oldMode !== this.isMobileTable) {
      setTimeout(() => this.table.recalculate(), 0);
    }
  }

  protected get rangeStart(): number {
    if (!this.totalCount) {
      return 0;
    }

    return (this.currentPage - 1) * this.pageSize + 1;
  }

  protected get rangeEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.totalCount);
  }

  protected onPageSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);

    if (!value) {
      return;
    }

    this.pageSize = value;
    this.currentPage = 1;
    this.updatePagedCases();
  }

  protected goToPreviousPage(): void {
    if (this.currentPage <= 1) {
      return;
    }

    this.currentPage--;
    this.updatePagedCases();
  }

  protected goToNextPage(): void {
    if (this.currentPage >= this.totalPages) {
      return;
    }

    this.currentPage++;
    this.updatePagedCases();
  }

  /** Whether the current user could actually save changes to this case - matches the
   * backend's canEditCase (Admin, or one of the case's responsibleUsers). Coordinators viewing
   * another org member's case only get a read-only view. */
  canEditCase(c: FullCase | undefined): boolean {
    const user = this.currentUser;
    if (!user || !c) return false;
    if (user.role === Role.Admin) return true;
    return c.responsibleUsers.some((ru) => ru.id === user.id);
  }

  edit(id: string): void {
    const c = this.allCases.find((c) => c.familyId === id);
    if (!this.canEditCase(c)) return;
    this.router.navigate(['edit-family', id]);
  }

  inspect(id: string): void {
    this.router.navigate(['edit-family', id], {
      queryParams: { readonly: true },
    });
  }

  toggleExpandRow(row: FullCase): void {
    this.table.rowDetail?.toggleExpandRow(row);
    setTimeout(() => this.table?.recalculate(), 0);
  }

  getAdressString(adress: PrismaJson.Address): string {
    return `${adress.street} ${adress.number}, ${adress.plz} ${adress.city}`;
  }

  private updateMobileTableMode(): void {
    this.isMobileTable = window.innerWidth <= 900;
  }

  private updatePagedCases(): void {
    this.totalCount = this.allCases.length;
    this.totalPages = Math.max(1, Math.ceil(this.totalCount / this.pageSize));

    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;

    this.pagedCases = this.allCases.slice(start, end);

    if (this.table) {
      this.table.offset = 0;
      this.table.recalculate();
    }
  }

  isDetailModalOpen = false;
  modalInitialTab: TabKey = 'stammdaten';
  selectedCase: FullCase | undefined = undefined;
  modalReadOnly = false;

  openDetailModal(caseId: string) {
    const c = this.allCases.find((c) => c.id === caseId);
    this.isDetailModalOpen = true;
    this.selectedCase = c;
    this.modalReadOnly = !this.canEditCase(c);
  }

  closeDetails() {
    this.isDetailModalOpen = false;
    this.fetchData();
  }
}
