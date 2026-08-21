import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EditFamilyComponent } from 'src/app/components/edit-family/edit-family';

@Component({
  selector: 'app-edit-family-page',
  standalone: true,
  imports: [EditFamilyComponent],
  templateUrl: './edit-family-page.html',
  styleUrl: './edit-family-page.scss',
})
export class EditFamilyPage {
  private activatedRoute = inject(ActivatedRoute);

  id = this.activatedRoute.snapshot.paramMap.get('id')!;
  readOnly =
    this.activatedRoute.snapshot.queryParamMap.get('readonly') === 'true';
}
