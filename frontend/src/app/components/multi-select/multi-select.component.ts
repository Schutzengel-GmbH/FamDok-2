import {
  Component,
  inject,
  input,
  linkedSignal,
  model,
  output,
} from '@angular/core';
import {
  NgbDropdown,
  NgbDropdownToggle,
  NgbDropdownMenu,
  NgbDropdownItem,
  NgbDropdownButtonItem,
} from '@ng-bootstrap/ng-bootstrap';

/** Default identity check: strict equality, falling back to `id` match when both operands
 *  are objects carrying an `id` (the common case - all current callers pass DB entities or
 *  select options that come from separate fetches than `items`). Primitive items and objects
 *  without `id` keep pure reference equality. */
function defaultCompare<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (
    a != null &&
    b != null &&
    typeof a === 'object' &&
    typeof b === 'object' &&
    'id' in a &&
    'id' in b
  ) {
    return (a as { id: unknown }).id === (b as { id: unknown }).id;
  }
  return false;
}

@Component({
  selector: 'app-multi-select',
  templateUrl: './multi-select.component.html',
  standalone: true,
  imports: [
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    NgbDropdownItem,
    NgbDropdownButtonItem,
  ],
})
export class MultiSelect<TItem> {
  /** The items to choose from.
   */
  items = input.required<TItem[]>();

  /** The initial value. Array.
   */
  value = model<TItem[]>([]);

  /** [Optional] The property of the items to use for labelling.
   */
  labelProp = input<TItem extends Record<string, any> ? keyof TItem : never>();

  protected label(item: TItem) {
    const labelProp = this.labelProp();
    return labelProp ? item[labelProp] : item;
  }

  /** Emits the array of selected items on change.
   */
  selectChange = output<TItem[]>();

  /** [Optional] Function to check identity of objects. Defaults to strict equality, falling
   * back to `a.id === b.id` when both items are objects with an `id`.
   */
  compareFn = input<(a: TItem, b: TItem) => boolean>(defaultCompare);

  /** [Optional] Maximum number of allowed elements selected
   */
  maximum = input<number | undefined>(undefined);

  /** [Optional] Text displayed when no elements selected.
   */
  placeholder = input<string>('Elemente auswählen');

  protected valueText = linkedSignal(() =>
    this.value()
      .map((item) =>
        this.labelProp() ? item[this.labelProp() as keyof TItem] : item,
      )
      .join(', '),
  );

  protected itemClick(item: TItem) {
    const index = this.selectedIndex(item);
    if (index >= 0) {
      this.value.update((cur) => cur.filter((_cur, i) => i !== index));
    } else {
      this.value.update((cur) => cur.concat(item));
    }
    this.emit();
  }

  protected selected(item: TItem) {
    return this.value().some((compare) => this.compareFn()(item, compare));
  }

  private selectedIndex(item: TItem) {
    return this.value().findIndex((compare) => this.compareFn()(item, compare));
  }

  private emit() {
    this.selectChange.emit(this.value());
  }
}
