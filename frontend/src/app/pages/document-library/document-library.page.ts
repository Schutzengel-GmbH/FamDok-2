import { AsyncPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DocumentService } from 'src/app/services/document.service';
import { MeService } from 'src/app/services/me.service';
import { ToastService } from 'src/app/services/toast.service';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';
import { FullDocument, FullTag } from '../../../../../shared/types';
import { Role } from '../../../../../shared/generated/prisma/enums';
import { MultiSelect } from 'src/app/components/multi-select/multi-select.component';
import { NameModalComponent } from 'src/app/components/settings/modals/name-modal/name-modal';
import {
  DocumentFormModalComponent,
  DocumentFormResult,
} from 'src/app/components/document-form-modal/document-form-modal.component';

@Component({
  selector: 'app-document-library',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, MultiSelect],
  templateUrl: './document-library.page.html',
})
export class DocumentLibraryPage {
  private documentService = inject(DocumentService);
  private toast = inject(ToastService);
  private dialogService = inject(ConfirmDialogService);
  private modalService = inject(NgbModal);

  protected readonly Role = Role;
  user$ = inject(MeService).getMe();

  protected documents = signal<FullDocument[]>([]);
  protected allTags = signal<FullTag[]>([]);

  protected search = signal('');
  protected selectedTags = signal<FullTag[]>([]);

  protected filteredDocuments = computed(() => {
    const search = this.search().trim().toLocaleLowerCase();
    const tagIds = this.selectedTags().map((t) => t.id);
    return this.documents().filter((doc) => {
      const matchesSearch =
        !search ||
        doc.title.toLocaleLowerCase().includes(search) ||
        (doc.description?.toLocaleLowerCase().includes(search) ?? false);
      const matchesTags =
        tagIds.length === 0 ||
        tagIds.every((id) => doc.tags.some((t) => t.id === id));
      return matchesSearch && matchesTags;
    });
  });

  constructor() {
    this.loadDocuments();
    this.loadTags();
  }

  private loadDocuments() {
    this.documentService
      .getDocuments()
      .subscribe((docs) => this.documents.set(docs));
  }

  private loadTags() {
    this.documentService.getTags().subscribe((tags) => this.allTags.set(tags));
  }

  protected download(doc: FullDocument) {
    this.documentService.downloadDocument(doc);
  }

  protected openUploadModal() {
    const modalRef = this.modalService.open(DocumentFormModalComponent);
    (modalRef.componentInstance as DocumentFormModalComponent).allTags =
      this.allTags();
    modalRef.closed.subscribe((result: DocumentFormResult | undefined) => {
      if (result?.reason !== 'save' || !result.file) return;
      this.documentService.uploadDocument(result.file, result.meta).subscribe({
        next: () => {
          this.toast.show({
            title: 'Hochgeladen',
            text: `"${result.meta.title}" wurde hochgeladen.`,
            severity: 'success',
          });
          this.loadDocuments();
        },
        error: () => {
          this.toast.show({
            title: 'Fehler',
            text: 'Beim Hochladen ist ein Fehler aufgetreten.',
            severity: 'danger',
          });
        },
      });
    });
  }

  protected openEditModal(doc: FullDocument) {
    const modalRef = this.modalService.open(DocumentFormModalComponent);
    const instance = modalRef.componentInstance as DocumentFormModalComponent;
    instance.document = doc;
    instance.allTags = this.allTags();
    modalRef.closed.subscribe((result: DocumentFormResult | undefined) => {
      if (result?.reason !== 'save') return;
      this.documentService.updateDocument(doc.id, result.meta).subscribe({
        next: () => {
          this.toast.show({
            title: 'Gespeichert',
            text: `"${result.meta.title}" wurde aktualisiert.`,
            severity: 'success',
          });
          this.loadDocuments();
        },
        error: () => {
          this.toast.show({
            title: 'Fehler',
            text: 'Beim Speichern ist ein Fehler aufgetreten.',
            severity: 'danger',
          });
        },
      });
    });
  }

  protected deleteDocument(doc: FullDocument) {
    this.dialogService.open({
      title: 'Dokument löschen?',
      text: `Soll "${doc.title}" wirklich gelöscht werden?`,
      style: 'danger',
      confirmAction: () => {
        this.documentService.deleteDocument(doc.id).subscribe({
          next: () => {
            this.toast.show({
              title: 'Gelöscht',
              text: `"${doc.title}" wurde gelöscht.`,
              severity: 'success',
            });
            this.loadDocuments();
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

  protected addTag() {
    const modalRef = this.modalService.open(NameModalComponent);
    modalRef.componentInstance.title = 'Tag hinzufügen';
    modalRef.componentInstance.label = 'Name des Tags';
    modalRef.closed.subscribe((result) => {
      if (result?.reason !== 'save') return;
      this.documentService.createTag(result.value).subscribe({
        next: () => {
          this.toast.show({
            title: 'Erstellt',
            text: `Tag "${result.value}" wurde erstellt.`,
            severity: 'success',
          });
          this.loadTags();
        },
        error: () => {
          this.toast.show({
            title: 'Fehler',
            text: 'Beim Erstellen ist ein Fehler aufgetreten.',
            severity: 'danger',
          });
        },
      });
    });
  }

  protected renameTag(tag: FullTag) {
    const modalRef = this.modalService.open(NameModalComponent);
    modalRef.componentInstance.title = 'Tag umbenennen';
    modalRef.componentInstance.label = 'Name des Tags';
    modalRef.componentInstance.name = tag.name;
    modalRef.closed.subscribe((result) => {
      if (result?.reason !== 'save') return;
      this.documentService.renameTag(tag.id, result.value).subscribe({
        next: () => {
          this.toast.show({
            title: 'Gespeichert',
            text: `Tag wurde umbenannt in "${result.value}".`,
            severity: 'success',
          });
          this.loadTags();
          this.loadDocuments();
        },
        error: () => {
          this.toast.show({
            title: 'Fehler',
            text: 'Beim Speichern ist ein Fehler aufgetreten.',
            severity: 'danger',
          });
        },
      });
    });
  }

  protected deleteTagAction(tag: FullTag) {
    this.dialogService.open({
      title: 'Tag löschen?',
      text: `Soll der Tag "${tag.name}" wirklich gelöscht werden?`,
      style: 'danger',
      confirmAction: () => {
        this.documentService.deleteTag(tag.id).subscribe({
          next: () => {
            this.toast.show({
              title: 'Gelöscht',
              text: `Tag "${tag.name}" wurde gelöscht.`,
              severity: 'success',
            });
            this.loadTags();
            this.loadDocuments();
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
