import {
  Component,
  inject,
  input,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { SimpleTextFilter } from 'src/app/components/filter-inputs/simple-text-filter/simple-text-filter.component';

@Component({
  selector: 'app-zusammenfassung-filter',
  standalone: true,
  templateUrl: './text-filter.component.html',
  styles: `
    .btn-no-outline {
      border: none;
    }
  `,
  imports: [FormsModule, SimpleTextFilter],
})
export class ZusammenfassungFilter {
  name = input.required<string>();
  filterChanged = output<string | undefined>();

  private modalService = inject(NgbModal);
  filterInput: string | undefined = undefined;
  active = signal(false);

  apply() {
    this.active.set(true);
    if (!this.filterInput) this.filterChanged.emit(undefined);
    else this.filterChanged.emit(this.filterInput);
  }

  cancel() {
    this.active.set(false);
    this.filterInput = undefined;
    this.filterChanged.emit(undefined);
  }

  open(modal: TemplateRef<any>) {
    this.modalService
      .open(modal, { backdrop: 'static', keyboard: false })
      .result.then((result) => {
        if (result === 'apply') this.apply();
        else this.cancel();
      });
  }
}
