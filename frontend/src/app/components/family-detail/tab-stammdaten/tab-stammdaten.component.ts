import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  inject,
  input,
  signal,
  computed,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FullCase } from '../../../../../../shared/types';
import {
  countChildrenPipe,
  userArrayPipe,
} from 'src/app/util/tableTransformPipes';
import { FamilienstandPipe } from 'src/app/pipes/familienstand.pipe';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { Role } from '../../../../../../shared/generated/prisma/enums';
import { MeService } from 'src/app/services/me.service';
import { FamilyService } from 'src/app/services/family.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-tab-stammdaten',
  standalone: true,
  imports: [CommonModule, FormsModule, FamilienstandPipe],
  templateUrl: './tab-stammdaten.component.html',
  styleUrls: ['./tab-stammdaten.component.scss'],
})
export class TabStammdatenComponent implements OnChanges {
  private router = inject(Router);
  private meService = inject(MeService);
  private familyService = inject(FamilyService);
  private toast = inject(ToastService);

  @Input({ required: true }) selectedCase!: FullCase;
  readOnly = input(false);

  private currentUser = toSignal(this.meService.getMe());

  protected downloading = signal<'stammdaten' | 'zip' | null>(null);

  /** Mirrors the backend's canExportCase: Admin, responsible users, and Org/SubOrgCoordinators
   * within their own org/suborg. Not a computed() - selectedCase is a plain @Input. */
  protected canExport(): boolean {
    const user = this.currentUser();
    const c = this.selectedCase;
    if (!user || !c.family) return false;
    if (user.role === Role.Admin) return true;
    if (c.responsibleUsers?.some((ru) => ru.id === user.id)) return true;
    if (user.role === Role.OrgCoordinator)
      return !!c.organisationId && user.organisationId === c.organisationId;
    if (user.role === Role.SubOrgCoordinator)
      return (
        !!c.subOrganisationId &&
        user.subOrganisations.some((so) => so.id === c.subOrganisationId)
      );
    return false;
  }

  protected downloadStammdaten() {
    this.runDownload(
      'stammdaten',
      this.familyService.downloadStammdatenPDF(
        this.selectedCase.id,
        this.selectedCase.family?.name ?? '',
      ),
    );
  }

  protected downloadCaseExport() {
    this.runDownload(
      'zip',
      this.familyService.downloadCaseExport(
        this.selectedCase.id,
        this.selectedCase.family?.name ?? '',
      ),
    );
  }

  private runDownload(kind: 'stammdaten' | 'zip', download$: Observable<void>) {
    if (this.downloading()) return;
    this.downloading.set(kind);
    download$.subscribe({
      next: () => this.downloading.set(null),
      error: () => {
        this.downloading.set(null);
        this.toast.show({
          title: 'Fehler',
          text: 'Beim Herunterladen ist ein Fehler aufgetreten.',
          severity: 'danger',
        });
      },
    });
  }

  protected countChildrenPipe = countChildrenPipe;
  protected userArrayPipe = userArrayPipe;

  protected selectedChildId = signal<string | undefined>(undefined);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedCase']) {
      this.selectedChildId.set(undefined);
    }
  }

  protected selectedChild = computed(() => {
    const id = this.selectedChildId();
    if (!id) return undefined;
    return this.selectedCase.family?.children?.find((x) => x.id === id);
  });

  getAdressString(adress: PrismaJson.Address | null | undefined) {
    if (!adress) return 'Keine Adresse hinterlegt';
    return `${adress.street} ${adress.number}, ${adress.plz} ${adress.city}`;
  }

  gotoHealthData(childId: string) {
    this.router.navigate(['gesundheit', this.selectedCase.id, childId], {
      queryParams: this.readOnly() ? { readonly: true } : {},
    });
  }
}
