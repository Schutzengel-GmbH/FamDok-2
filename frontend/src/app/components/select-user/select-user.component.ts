import { Component, input, output } from '@angular/core';
import { FullUser } from '../../../../../shared/types';
import { UserPipe } from '../../pipes/user.pipe';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';

@Component({
  selector: 'app-select-user',
  standalone: true,
  templateUrl: './select-user.component.html',
  imports: [
    NgSelectComponent,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
    UserPipe,
  ],
})
export class SelectUser {
  users = input.required<FullUser[]>();
  selectUser = output<FullUser | null>();
}
