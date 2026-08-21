import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  signal,
  linkedSignal,
  inject,
  Output,
  EventEmitter,
  input,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FullCase, Warning } from '../../../../../../shared/types';
import { WarningType } from '../../../../../../shared/consts';
import { FamilyService } from 'src/app/services/family.service';
import { ToastService } from 'src/app/services/toast.service';
import { WarningsService } from 'src/app/services/warnings.service';
import { isAfter } from 'date-fns';
import {
  NgbDateAdapter,
  NgbDateNativeAdapter,
  NgbDateParserFormatter,
  NgbInputDatepicker,
} from '@ng-bootstrap/ng-bootstrap';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { Topics } from '../../../../../../shared/definitions/zielvereinbarung';
import { NgbDateDeParserFormatter } from 'src/app/util/NgbDatePickerFormatter';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { Status } from '../../../../../../shared/generated/prisma/enums';
import { ZielvereinbarungModel as Zielvereinbarung } from '../../../../../../shared/generated/prisma/models';
import { CaseService } from 'src/app/services/case.service';
import {
  ZielvereinbarungCreateInput,
  ZielvereinbarungUpdateInput,
} from '../../../../../../shared/generated/prisma/models';

type ZvWarning = Extract<
  Warning,
  { type: WarningType.ZV_EXPIRED | WarningType.ZV_EXPIRING_SOON }
>;

@Component({
  selector: 'app-tab-zielvereinbarungen',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgbInputDatepicker,
    NgSelectComponent,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
  ],
  templateUrl: './tab-zielvereinbarungen.component.html',
  styleUrls: ['./tab-zielvereinbarungen.component.scss'],
  providers: [
    { provide: NgbDateAdapter, useClass: NgbDateNativeAdapter },
    { provide: NgbDateParserFormatter, useClass: NgbDateDeParserFormatter },
  ],
})
export class TabZielvereinbarungenComponent {
  selectedCase = input.required<FullCase>();
  readOnly = input(false);

  @Output() zielChange = new EventEmitter<void>();

  private caseService = inject(CaseService);
  private toastService = inject(ToastService);
  private dialogService = inject(ConfirmDialogService);
  private warningsService = inject(WarningsService);

  private warnings = toSignal(this.warningsService.getWarnings(), {
    initialValue: [] as Warning[],
  });

  private zvWarningsById = computed(() => {
    const caseId = this.selectedCase().id;
    const map = new Map<string, ZvWarning>();
    for (const w of this.warnings()) {
      if (
        (w.type === WarningType.ZV_EXPIRED ||
          w.type === WarningType.ZV_EXPIRING_SOON) &&
        w.data.caseId === caseId
      ) {
        map.set(w.data.zielvereinbarungsId, w);
      }
    }
    return map;
  });

  protected ziele = linkedSignal(() => this.selectedCase().zielvereinbarungen);
  protected currentZiel = signal<Partial<Zielvereinbarung>>({});

  protected zielFormOpen = signal<boolean>(false);

  protected Topics = Topics;
  protected status: Status[] = [Status.done, Status.failed, Status.inProgress];

  openZielFormNew() {
    this.currentZiel.set({
      startedAt: new Date(),
      status: Status.inProgress,
    });
    this.zielFormOpen.set(true);
  }

  openZielFormEdit(id: string) {
    const z = this.ziele().find((z) => z.id === id);
    if (!z) throw new Error('Keine Zielvereinbarung gefunden');
    this.currentZiel.set(z);
    this.zielFormOpen.set(true);
  }

  cancelZielForm() {
    this.resetCurrentZiel();
    this.zielFormOpen.set(false);
  }

  resetCurrentZiel() {
    this.currentZiel.set({
      startedAt: new Date(),
      status: Status.inProgress,
    });
  }

  currentZielValid() {
    const errors = this.zielErrors();
    return Object.keys(errors).reduce(
      (prev, key) => prev && !errors[key as keyof typeof errors],
      true,
    );
  }

  zielErrors() {
    return {
      startedAt: Boolean(!this.currentZiel().startedAt),
      finishBy: Boolean(!this.currentZiel().finishBy),
      topic: Boolean(!this.currentZiel().topic),
      status: Boolean(!this.currentZiel().status),
      description: Boolean(!this.currentZiel().description),
      isAfter: !isAfter(
        this.currentZiel().finishBy!,
        this.currentZiel().startedAt!,
      ),
    };
  }

  changeZiel(field: keyof Zielvereinbarung, value: any) {
    this.currentZiel.update((z) => ({ ...z, [field]: value }));
  }

  saveZiel() {
    if (this.currentZielValid()) {
      if (this.currentZiel().id) {
        this.updateZiel();
      } else {
        this.addZiel();
      }
    } else
      this.toastService.show({
        title: 'Fehler',
        text: 'Die Zielvereinbarung enthält noch Fehler.',
        severity: 'warning',
      });
  }

  addZiel() {
    this.caseService
      .addZiel(
        this.selectedCase().id,
        this.currentZiel() as ZielvereinbarungCreateInput,
      )
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Gespeichert',
            text: 'Zielvereinbarung gespeichert',
            severity: 'success',
          });
          this.zielFormOpen.set(false);
          this.zielChange.emit();
        },
        error: (error) => {
          this.toastService.show({
            title: 'Fehler',
            text:
              'Beim Speichern ist ein Fehler aufgetreten: ' + error.message ||
              error,
            severity: 'danger',
          });
          this.zielChange.emit();
        },
      });
  }

  updateZiel() {
    const update = {
      topic: this.currentZiel().topic,
      description: this.currentZiel().description,
      startedAt: this.currentZiel().startedAt,
      finishBy: this.currentZiel().finishBy,
      status: this.currentZiel().status,
    } as ZielvereinbarungUpdateInput;
    this.caseService
      .updateZiel(this.selectedCase().id, this.currentZiel().id!, update)
      .subscribe({
        next: () => {
          this.toastService.show({
            title: 'Gespeichert',
            text: 'Zielvereinbarung geändert',
            severity: 'success',
          });
          this.zielFormOpen.set(false);
          this.zielChange.emit();
        },
        error: (error) => {
          this.toastService.show({
            title: 'Fehler',
            text:
              'Beim Speichern ist ein Fehler aufgetreten: ' + error.message ||
              error,
            severity: 'danger',
          });
          this.zielChange.emit();
        },
      });
  }

  deleteZiel(id: string) {
    this.dialogService.open({
      title: 'Löschen?',
      text: 'Soll diese Zielvereinbarung wirklich gelöscht werden?',
      confirmAction: () => {
        this._deleteZiel(id);
      },
    });
  }

  private _deleteZiel(id: string) {
    this.caseService.deleteZiel(this.selectedCase().id, id).subscribe({
      next: () => {
        this.toastService.show({
          title: 'Gelöscht',
          text: 'Zielvereinbarung erfolgreich gelöscht',
          severity: 'success',
        });
        this.zielChange.emit();
      },
      error: (error) => {
        this.toastService.show({
          title: 'Fehler',
          text:
            'Beim Löschen ist ein Fehler aufgetreten: ' + error.message ||
            error,
          severity: 'danger',
        });
        this.zielChange.emit();
      },
    });
  }

  zielDotClass(status: Status | undefined) {
    switch (status) {
      case 'inProgress':
        return 'status-dot status-dot--yellow';
      case 'done':
        return 'status-dot status-dot--green';
      case 'failed':
        return 'status-dot status-dot--red';
      default:
        return 'status-dot';
    }
  }

  zielBadgeClass(status: Status | undefined) {
    switch (status) {
      case 'inProgress':
        return 'badge-soft badge-soft--yellow';
      case 'done':
        return 'badge-soft badge-soft--green';
      case 'failed':
        return 'badge-soft badge-soft--red';
      default:
        return 'badge-soft';
    }
  }

  zielWarningTooltip(id: string): string | undefined {
    const w = this.zvWarningsById().get(id);
    if (!w) return undefined;
    return w.type === WarningType.ZV_EXPIRED
      ? `Zielvereinbarung abgelaufen seit ${this.formatDate(w.data.finishBy)}.`
      : `Zielvereinbarung läuft bald ab (${this.formatDate(w.data.finishBy)}).`;
  }

  private formatDate(d: Date): string {
    return new Date(d).toLocaleDateString('de-DE');
  }

  zielBadgeText(status: Status | undefined) {
    switch (status) {
      case 'inProgress':
        return 'In Arbeit';
      case 'done':
        return 'Ziel erreicht';
      case 'failed':
        return 'Ziel nicht erreicht';
      default:
        return 'Unbekannt';
    }
  }
}
