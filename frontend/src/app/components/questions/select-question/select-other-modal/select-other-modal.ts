import { Component, inject, Input, linkedSignal } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { Answer } from '../../../../../../../shared/generated/prisma/client';

@Component({
  selector: 'app-select-other-modal',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './select-other-modal.html',
  styleUrl: './select-other-modal.css',
})
export class SelectOtherModalComponent {
  @Input({ required: true }) selectOption!: PrismaJson.SelectOption;
  @Input({ required: true }) answer!: Answer;

  activeModal = inject(NgbActiveModal);

  value = linkedSignal(() => this.answer?.answerText || '');

  constructor() {}

  onChange(e: Event) {
    const v = (e.currentTarget as HTMLInputElement).value;
    this.value.set(v);
  }

  save() {
    this.activeModal.close({ reason: 'save', value: this.value() });
  }

  cancel() {
    this.activeModal.close({ reason: 'cancel' });
  }
}
