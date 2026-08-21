import { Component, inject } from '@angular/core';
import { MeService } from 'src/app/services/me.service';
import { FullUser } from '../../../../../shared/types';

@Component({
  selector: 'app-me',
  standalone: true,
  imports: [],
  templateUrl: './me.html',
  styleUrl: './me.scss',
})
export class MeComponent {
  private meService = inject(MeService);

  protected user!: FullUser | undefined;

  constructor() {
    this.meService.getMe().subscribe((u) => (this.user = u));
  }
}
