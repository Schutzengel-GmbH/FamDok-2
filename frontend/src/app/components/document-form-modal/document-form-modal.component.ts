import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FullDocument, FullTag } from '../../../../../shared/types';
import { MultiSelect } from '../multi-select/multi-select.component';
import { DocumentMetaInput } from 'src/app/services/document.service';

export interface DocumentFormResult {
  reason: 'save';
  meta: DocumentMetaInput;
  file?: File;
}

/** Create/edit modal for a document library entry. In edit mode (`document` set) the file
 * input is hidden - replacing the underlying file isn't supported, only its metadata. */
@Component({
  selector: 'app-document-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, MultiSelect],
  templateUrl: './document-form-modal.component.html',
})
export class DocumentFormModalComponent implements OnInit {
  @Input() document?: FullDocument;
  @Input() allTags: FullTag[] = [];

  private fb = inject(FormBuilder);
  protected activeModal = inject(NgbActiveModal);

  protected form!: FormGroup;
  protected selectedTags = signal<FullTag[]>([]);
  protected file = signal<File | undefined>(undefined);

  ngOnInit() {
    this.form = this.fb.group({
      title: [this.document?.title ?? '', [Validators.required]],
      description: [this.document?.description ?? ''],
    });
    this.selectedTags.set(this.document?.tags ?? []);
  }

  filesChanged(e: Event) {
    const input = e.target as HTMLInputElement;
    this.file.set(input.files?.item(0) ?? undefined);
  }

  save() {
    this.activeModal.close({
      reason: 'save',
      meta: {
        title: this.form.value.title as string,
        description: this.form.value.description as string,
        tagIds: this.selectedTags().map((t) => t.id),
      },
      file: this.file(),
    } satisfies DocumentFormResult);
  }

  cancel() {
    this.activeModal.close({ reason: 'cancel' });
  }

  protected get isEdit() {
    return !!this.document;
  }

  protected get canSave() {
    return this.form.valid && (this.isEdit || !!this.file());
  }
}
