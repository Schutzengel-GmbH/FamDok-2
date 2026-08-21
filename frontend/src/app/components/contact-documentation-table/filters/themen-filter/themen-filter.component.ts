import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FormsModule } from '@angular/forms';
import { SimpleSelectFilter } from 'src/app/components/filter-inputs/simple-select-filter/simple-select-filter.component';
import { ContactDocumentationOptions } from '../../../../../../../shared/sharedGlobals';
import { ContactDocumentationModel as ContactDocumentation } from '../../../../../../../shared/generated/prisma/models';
import {
  ContactDocumentationWhereInput,
  StringFilter,
  StringNullableListFilter,
} from '../../../../../../../shared/generated/prisma/models';

@Component({
  selector: 'app-themen-filter',
  standalone: true,
  templateUrl: './themen-filter.component.html',
  styles: `
    .btn-no-outline {
      border: none;
    }
  `,
  imports: [FormsModule, SimpleSelectFilter],
})
export class ThemenFilter {
  filterChanged = output<number | undefined>();
  prop =
    input.required<
      keyof Omit<
        ContactDocumentation,
        | 'id'
        | 'userId'
        | 'date'
        | 'zusammenfassung'
        | 'dokumentation'
        | 'duration'
        | 'caseId'
      >
    >();

  options = computed(() => ContactDocumentationOptions[this.prop()]);

  private modalService = inject(NgbModal);
  filterInput: PrismaJson.SelectOption | undefined = undefined;
  active = signal(false);

  apply() {
    if (this.filterInput === undefined) {
      this.active.set(false);
      this.filterChanged.emit(undefined);
      return;
    }
    this.active.set(true);
    this.filterChanged.emit(this.filterInput.id);
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
