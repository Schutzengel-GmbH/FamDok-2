import { DatePipe } from '@angular/common';
import { Component, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  FullCase,
  FullCaseAttachment,
  FullUser,
} from '../../../../../../shared/types';
import { CaseService } from 'src/app/services/case.service';
import { MeService } from 'src/app/services/me.service';
import { ToastService } from 'src/app/services/toast.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { Role } from '../../../../../../shared/generated/prisma/enums';

@Component({
  selector: 'app-tab-anhaenge',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './tab-anhaenge.component.html',
  styleUrls: ['./tab-anhaenge.component.scss'],
})
export class TabAnhaengeComponent implements OnInit {
  selectedCase = input.required<FullCase>();
  readOnly = input(false);

  private caseService = inject(CaseService);
  private toast = inject(ToastService);
  private dialogService = inject(ConfirmDialogService);

  protected me = signal<FullUser | undefined>(undefined);
  protected attachments = signal<FullCaseAttachment[]>([]);
  protected note = signal('');

  constructor() {
    inject(MeService)
      .getMe()
      .subscribe((user) => this.me.set(user));
  }

  ngOnInit() {
    this.load();
  }

  private load() {
    this.caseService
      .getAttachments(this.selectedCase().id)
      .subscribe((attachments) => this.attachments.set(attachments));
  }

  protected get canUpload(): boolean {
    if (this.readOnly()) return false;
    return this.me()?.role !== Role.Controller;
  }

  protected canDelete(attachment: FullCaseAttachment): boolean {
    if (this.readOnly()) return false;
    const user = this.me();
    if (!user) return false;
    if (user.role === Role.Admin) return true;
    return attachment.uploadedById === user.id;
  }

  filesChanged(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.item(0);
    input.value = '';
    if (!file) return;

    this.caseService
      .uploadAttachment(this.selectedCase().id, file, this.note() || undefined)
      .subscribe({
        next: () => {
          this.toast.show({
            title: 'Hochgeladen',
            text: `"${file.name}" wurde angehängt.`,
            severity: 'success',
          });
          this.note.set('');
          this.load();
        },
        error: () => {
          this.toast.show({
            title: 'Fehler',
            text: 'Beim Hochladen ist ein Fehler aufgetreten.',
            severity: 'danger',
          });
        },
      });
  }

  download(attachment: FullCaseAttachment) {
    this.caseService.downloadAttachment(this.selectedCase().id, attachment);
  }

  deleteAttachment(attachment: FullCaseAttachment) {
    this.dialogService.open({
      title: 'Anhang löschen?',
      text: `Soll "${attachment.filename}" wirklich gelöscht werden?`,
      style: 'danger',
      confirmAction: () => {
        this.caseService
          .deleteAttachment(this.selectedCase().id, attachment.id)
          .subscribe({
            next: () => {
              this.toast.show({
                title: 'Gelöscht',
                text: `"${attachment.filename}" wurde gelöscht.`,
                severity: 'success',
              });
              this.load();
            },
            error: () => {
              this.toast.show({
                title: 'Fehler',
                text: 'Beim Löschen ist ein Fehler aufgetreten.',
                severity: 'danger',
              });
            },
          });
      },
    });
  }
}
