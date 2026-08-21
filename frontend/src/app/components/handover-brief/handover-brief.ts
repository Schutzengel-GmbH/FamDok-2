import { Component, input } from '@angular/core';
import { FullUser, Handover } from '../../../../../shared/types';
import { DatePipe } from '@angular/common';
import { UserPipe } from 'src/app/pipes/user.pipe';

@Component({
  selector: 'app-handover-brief',
  templateUrl: './handover-brief.html',
  imports: [DatePipe, UserPipe],
  standalone: true,
})
export class HandoverBrief {
  handover = input.required<
    Handover & { added: FullUser[]; removed: FullUser[] }
  >();
}
