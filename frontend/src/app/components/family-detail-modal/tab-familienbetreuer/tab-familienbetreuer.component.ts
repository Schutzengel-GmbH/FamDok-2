import { Component, inject, input, model, output, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FamilyService } from 'src/app/services/family.service';
import { FullCase, FullUser } from '../../../../../../shared/types';
import { UserPipe } from '../../../pipes/user.pipe';
import { SelectUser } from '../../select-user/select-user.component';
import { UserService } from 'src/app/services/user.service';
import { MeService } from 'src/app/services/me.service';
import { map, mergeMap } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ToastService } from 'src/app/services/toast.service';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HandoverBrief } from '../../handover-brief/handover-brief';
import { CaseService } from 'src/app/services/case.service';

@Component({
  selector: 'app-tab-familienbetreuer',
  standalone: true,
  imports: [AsyncPipe, FormsModule, HandoverBrief, UserPipe, SelectUser],
  templateUrl: './tab-familienbetreuer.component.html',
  styleUrls: ['./tab-familienbetreuer.component.scss'],
})
export class TabFamilienbetreuerComponent {
  selectedCase = model.required<FullCase>();
  readOnly = input(false);
  changes = output<{ userRemoved: boolean }>();

  private caseService = inject(CaseService);
  private userService = inject(UserService);
  private meService = inject(MeService);
  private toast = inject(ToastService);

  protected users$ = this.meService.getMe().pipe(
    mergeMap((me) =>
      this.userService.getOrgUsers(me.organisationId!, {
        id: { not: me.id },
      }),
    ),
  );
  protected handovers = toSignal(
    toObservable(this.selectedCase).pipe(
      mergeMap((c) => {
        return this.caseService.getHandovers(c.id);
      }),
    ),
  );

  protected user = model<FullUser | null>();
  protected notes = model<string>('');
  protected removeMe = model<boolean>(false);

  error() {
    if (
      this.removeMe() &&
      this.selectedCase().responsibleUsers.length < 2 &&
      !this.user()
    )
      return 'Mindestens eine Fachkraft muss betreuen!';

    return '';
  }

  handover() {
    if (this.readOnly()) return;
    this.meService
      .getMe()
      .pipe(
        mergeMap((me) =>
          this.caseService.handover({
            caseId: this.selectedCase().id,
            date: new Date(),
            notes: this.notes(),
            removedIds: this.removeMe() ? [me.id] : [],
            addedIds: this.user() ? [this.user()!.id] : [],
          }),
        ),
      )
      .subscribe({
        next: () => {
          this.toast.show({
            title: 'Übergabe erfolgreich',
            text: 'Fall wurde übergeben',
            severity: 'success',
          });

          this.changes.emit({ userRemoved: this.removeMe() });
        },
        error: (e) =>
          this.toast.show({
            title: 'Fehler',
            text: `Es ist ein Fehler aufgetreten: ${e}`,
            severity: 'danger',
          }),
      });
  }
}
