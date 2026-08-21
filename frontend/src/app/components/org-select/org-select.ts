import { Component, inject, model } from '@angular/core';
import { FullOrganisation } from '../../../../../shared/types';
import {
  NgSelectComponent,
  NgLabelTemplateDirective,
} from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { OrgService } from 'src/app/services/organisation.service';

@Component({
  selector: 'app-org-select',
  standalone: true,
  imports: [NgSelectComponent, NgLabelTemplateDirective, FormsModule],
  templateUrl: './org-select.html',
  styleUrl: './org-select.scss',
})
export class OrgSelectComponent {
  private orgService = inject(OrgService);

  org = model<FullOrganisation | undefined>(undefined);

  protected orgs!: FullOrganisation[];

  constructor() {
    this.orgService.getAll().subscribe((orgs) => (this.orgs = orgs));
  }

  handleChange(org: FullOrganisation) {
    this.org.set(org);
  }
}
