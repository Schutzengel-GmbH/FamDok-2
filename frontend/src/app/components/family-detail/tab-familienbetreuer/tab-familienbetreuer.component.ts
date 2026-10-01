import { Component, inject, model, output } from '@angular/core';
import { FullCase } from '../../../../../../shared/types';
import { UserPipe } from '../../../pipes/user.pipe';
import { mergeMap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HandoverBrief } from '../../handover-brief/handover-brief';
import { CaseHandoverComponent } from '../../case-handover/case-handover.component';
import { CaseService } from 'src/app/services/case.service';

@Component({
  selector: 'app-tab-familienbetreuer',
  standalone: true,
  imports: [HandoverBrief, UserPipe, CaseHandoverComponent],
  templateUrl: './tab-familienbetreuer.component.html',
})
export class TabFamilienbetreuerComponent {
  selectedCase = model.required<FullCase>();
  changes = output<{ userRemoved: boolean }>();

  private caseService = inject(CaseService);

  protected handovers = toSignal(
    toObservable(this.selectedCase).pipe(
      mergeMap((c) => {
        return this.caseService.getHandovers(c.id);
      }),
    ),
  );
}
