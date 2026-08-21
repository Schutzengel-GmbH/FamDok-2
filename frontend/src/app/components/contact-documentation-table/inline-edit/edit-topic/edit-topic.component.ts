import {
  Component,
  computed,
  input,
  linkedSignal,
  output,
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

  protected _value = linkedSignal(() => {
    if (this.prop() === 'artDerBetreuung') {
      const single = this.value() as PrismaJson.SelectOption | undefined;
      return single ? [single] : [];
    }
    return this.value() as PrismaJson.SelectOption[];
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
}
