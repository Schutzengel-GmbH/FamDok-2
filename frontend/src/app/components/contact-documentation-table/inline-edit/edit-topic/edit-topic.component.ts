import {
  Component,
  computed,
  input,
  linkedSignal,
  output,
  untracked,
} from '@angular/core';
import { ContactDocumentationOptions } from '../../../../../../../shared/sharedGlobals';
import { MultiSelect } from 'src/app/components/multi-select/multi-select.component';

@Component({
  selector: 'app-inline-topic',
  templateUrl: './edit-topic.component.html',
  standalone: true,
  imports: [MultiSelect],
})
export class EditTopic {
  prop = input.required<keyof typeof ContactDocumentationOptions>();
  value = input.required<
    PrismaJson.SelectOption[] | PrismaJson.SelectOption | undefined
  >();
  save = output<PrismaJson.SelectOption[] | PrismaJson.SelectOption | null>();
  nochange = output<void>();

  options = computed(() => ContactDocumentationOptions[this.prop()]);

  /** Incoming selection normalised to an array (single- and multi-value props). */
  private incomingSelection = computed<PrismaJson.SelectOption[]>(() => {
    const v = this.value();
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
  });

  /** Local, editable copy of the selection.
   *
   * Sourced from a stable id-key rather than the input array's identity: the parent rebuilds
   * the `value` array on every change-detection pass, and a plain `linkedSignal(() =>
   * this.value())` would be re-seeded by that churn, dropping a click before it renders.
   * Returning `previous.value` while the id-key is unchanged keeps the in-progress edit; a
   * real change to the saved ids still re-seeds. */
  protected _value = linkedSignal<string, PrismaJson.SelectOption[]>({
    source: () =>
      this.incomingSelection()
        .map((o) => o.id)
        .join(','),
    computation: (key, previous) =>
      previous && previous.source === key
        ? previous.value
        : untracked(() => this.incomingSelection()),
  });

  change(options: PrismaJson.SelectOption[]) {
    this._value.set(options);
  }

  apply() {
    if (this.prop() === 'artDerBetreuung')
      this.save.emit(this._value()?.at(0) || null);
    else this.save.emit(this._value() || null);
  }

  cancel() {
    this.nochange.emit();
  }

  compareFn(a: PrismaJson.SelectOption, b: PrismaJson.SelectOption) {
    return a.id === b.id;
  }
}
