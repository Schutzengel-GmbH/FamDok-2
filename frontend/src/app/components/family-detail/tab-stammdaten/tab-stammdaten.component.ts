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
import { from, Observable } from 'rxjs';
import { ExportService } from 'src/app/services/export.service';
import { Role } from '../../../../../../shared/generated/prisma/enums';
import { MeService } from 'src/app/services/me.service';
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
  private exportService = inject(ExportService);
  private toast = inject(ToastService);

  @Input({ required: true }) selectedCase!: FullCase;
  readOnly = input(false);

  private currentUser = toSignal(this.meService.getMe());

  protected downloading = signal<'stammdaten' | 'zip' | null>(null);

  /** Who may export a case: Admin, responsible users, and Org/SubOrgCoordinators within their
   * own org/suborg. The export is built in the browser from the decrypted data, so in encrypted
   * orgs it also needs the unlocked key. Not a computed() - selectedCase is a plain @Input. */
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
      from(this.exportService.downloadStammdaten(this.selectedCase.id)),
    );
  }

  protected downloadCaseExport() {
    this.runDownload(
      'zip',
      from(this.exportService.downloadCaseExport(this.selectedCase.id)),
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
