import { Component, inject, output, signal, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { OrgService } from 'src/app/services/organisation.service';
import { FullOrganisation } from '../../../../../shared/types';
import { UserWhereInput } from '../../../../../shared/generated/prisma/models';
import { isEmptyObject } from 'src/app/util/generalUtils';

/** Filters a "Erstellt von" column by the creator's organisation and (optionally) one of its
 * sub-organisations. Emits a `createdBy` where-filter fragment. */
@Component({
  selector: 'app-created-by-org-filter',
  standalone: true,
  templateUrl: './created-by-org-filter.component.html',
  styles: `
    .btn-no-outline {
      border: none;
    }
  `,
  imports: [FormsModule],
})
export class CreatedByOrgFilter {
  filterChanged = output<UserWhereInput>();

  private modalService = inject(NgbModal);
  private orgService = inject(OrgService);

  protected orgs!: FullOrganisation[];

  protected organisationId: string | undefined;
  protected subOrganisationId: string | undefined;
  active = signal(false);

  constructor() {
    this.orgService.getAll().subscribe((orgs) => (this.orgs = orgs));
  }

  protected get availableSubOrgs() {
    return (
      this.orgs?.find((o) => o.id === this.organisationId)
        ?.subOrganisations ?? []
    );
  }

  protected onOrgChange() {
    this.subOrganisationId = undefined;
  }

  apply() {
    const filter: UserWhereInput = {
      ...(this.organisationId
        ? { organisationId: this.organisationId }
        : {}),
      ...(this.subOrganisationId
        ? { subOrganisations: { some: { id: this.subOrganisationId } } }
        : {}),
    };
    this.active.set(!isEmptyObject(filter));
    this.filterChanged.emit(filter);
  }

  cancel() {
    this.active.set(false);
    this.organisationId = undefined;
    this.subOrganisationId = undefined;
    this.filterChanged.emit({});
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
