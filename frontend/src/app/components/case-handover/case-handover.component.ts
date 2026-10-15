import { Component, computed, inject, input, model, output } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { mergeMap } from 'rxjs';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { FullCase, FullUser, Handover } from '../../../../../shared/types';
import { UserPipe } from '../../pipes/user.pipe';
import { SelectUser } from '../select-user/select-user.component';
import { UserService } from 'src/app/services/user.service';
import { MeService } from 'src/app/services/me.service';
import { ToastService } from 'src/app/services/toast.service';
import { CaseService } from 'src/app/services/case.service';

export type HandoverMode = 'coordinator' | 'own' | 'none';

@Component({
  selector: 'app-case-handover',
  standalone: true,
  imports: [
    AsyncPipe,
    FormsModule,
    UserPipe,
    SelectUser,
    NgSelectComponent,
    NgLabelTemplateDirective,
    NgOptionTemplateDirective,
  ],
  templateUrl: './case-handover.component.html',
})
export class CaseHandoverComponent {
  selectedCase = input.required<FullCase>();
  changes = output<{ userRemoved: boolean }>();

  private caseService = inject(CaseService);
  private userService = inject(UserService);
  private meService = inject(MeService);
  private toast = inject(ToastService);

  protected me = toSignal(this.meService.getMe());

  /**
   * Coordinators of the case's org/subOrg get the org-wide handover UI, users responsible for the
   * case get the personal one. Mirrors canHandover in the backend.
   */
  protected mode = computed<HandoverMode>(() => {
    const me = this.me();
    const c = this.selectedCase();
    if (!me) return 'none';

    if (me.role === 'OrgCoordinator' && me.organisationId === c.organisationId)
      return 'coordinator';
    if (
      me.role === 'SubOrgCoordinator' &&
      me.subOrganisations.some((s) => s.id === c.subOrganisationId)
    )
      return 'coordinator';
    if (c.responsibleUsers.some((u) => u.id === me.id)) return 'own';

    return 'none';
  });

  protected notes = model<string>('');

  // --- own handover ---

  protected ownUsers$ = this.meService.getMe().pipe(
    mergeMap((me) =>
      this.userService.getOrgUsers(me.organisationId!, {
        id: { not: me.id },
      }),
    ),
  );

  protected user = model<FullUser | null>();
  protected removeMe = model<boolean>(false);

  // --- coordinator handover ---

  protected orgUsers$ = toObservable(this.selectedCase).pipe(
    mergeMap((c) =>
      this.userService.getOrgUsers(c.organisationId, {
        id: { notIn: c.responsibleUsers.map((u) => u.id) },
      }),
    ),
  );

  protected addedUsers = model<FullUser[]>([]);
  protected removedIds = model<string[]>([]);

  protected compareUsers = (a: FullUser, b: FullUser) => a?.id === b?.id;

  protected toggleRemoved(id: string, removed: boolean) {
    this.removedIds.update((ids) =>
      removed ? [...ids, id] : ids.filter((x) => x !== id),
    );
  }

  error() {
    if (this.mode() === 'own') {
      if (
        this.removeMe() &&
        this.selectedCase().responsibleUsers.length < 2 &&
        !this.user()
      )
        return 'Mindestens eine Fachkraft muss betreuen!';
    }

    if (this.mode() === 'coordinator') {
      const remaining =
        this.selectedCase().responsibleUsers.filter(
          (u) => !this.removedIds().includes(u.id),
        ).length + this.addedUsers().length;
      if (remaining < 1) return 'Mindestens eine Fachkraft muss betreuen!';
    }

    return '';
  }

  hasChanges() {
    if (this.mode() === 'own') return this.removeMe() || !!this.user();
    if (this.mode() === 'coordinator')
      return this.removedIds().length > 0 || this.addedUsers().length > 0;
    return false;
  }

  handover() {
    const me = this.me();
    if (!me || this.mode() === 'none' || this.error() || !this.hasChanges())
      return;

    // Coordinators keep access to the case even after removing themselves.
    const userRemoved = this.mode() === 'own' && this.removeMe();

    const handover: Handover =
      this.mode() === 'own'
        ? {
            caseId: this.selectedCase().id,
            date: new Date(),
            notes: this.notes(),
            removedIds: this.removeMe() ? [me.id] : [],
            addedIds: this.user() ? [this.user()!.id] : [],
          }
        : {
            caseId: this.selectedCase().id,
            date: new Date(),
            notes: this.notes(),
            removedIds: this.removedIds(),
            addedIds: this.addedUsers().map((u) => u.id),
          };

    this.caseService.handover(handover).subscribe({
      next: () => {
        this.toast.show({
          title: 'Übergabe erfolgreich',
          text: 'Fall wurde übergeben',
          severity: 'success',
        });

        this.reset();
        this.changes.emit({ userRemoved });
      },
      error: (e) =>
        this.toast.show({
          title: 'Fehler',
          text: `Es ist ein Fehler aufgetreten: ${e}`,
          severity: 'danger',
        }),
    });
  }

  private reset() {
    this.notes.set('');
    this.addedUsers.set([]);
    this.removedIds.set([]);
  }
}
