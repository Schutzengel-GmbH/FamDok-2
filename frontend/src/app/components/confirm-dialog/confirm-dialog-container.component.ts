import { Component, inject } from '@angular/core';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog-container',
  templateUrl: './confirm-dialog-container.component.html',
  standalone: true,
  host: {
    class: 'confirm-modal position-fixed top-0 end-0 p-2',
    style: 'z-index: 9001',
  },
})
export class ConfirmDialogContainer {
  protected readonly dialogService = inject(ConfirmDialogService);
}
