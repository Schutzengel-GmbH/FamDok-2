import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  inject,
  input,
  signal,
  computed,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FullCase } from '../../../../../../shared/types';
import {
  countChildrenPipe,
  userArrayPipe,
} from 'src/app/util/tableTransformPipes';
import { FamilienstandPipe } from 'src/app/pipes/familienstand.pipe';

@Component({
  selector: 'app-tab-stammdaten',
  standalone: true,
  imports: [CommonModule, FormsModule, FamilienstandPipe],
  templateUrl: './tab-stammdaten.component.html',
  styleUrls: ['./tab-stammdaten.component.scss'],
})
export class TabStammdatenComponent implements OnChanges {
  private router = inject(Router);

  @Input({ required: true }) selectedCase!: FullCase;
  readOnly = input(false);

  protected countChildrenPipe = countChildrenPipe;
  protected userArrayPipe = userArrayPipe;

  protected selectedChildId = signal<string | undefined>(undefined);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedCase']) {
      this.selectedChildId.set(undefined);
    }
  }

  protected selectedChild = computed(() => {
    const id = this.selectedChildId();
    if (!id) return undefined;
    return this.selectedCase.family?.children?.find((x) => x.id === id);
  });

  getAdressString(adress: PrismaJson.Address | null | undefined) {
    if (!adress) return 'Keine Adresse hinterlegt';
    return `${adress.street} ${adress.number}, ${adress.plz} ${adress.city}`;
  }

  gotoHealthData(childId: string) {
    this.router.navigate(['gesundheit', this.selectedCase.id, childId], {
      queryParams: this.readOnly() ? { readonly: true } : {},
    });
  }
}
