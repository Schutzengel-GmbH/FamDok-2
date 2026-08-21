import { Component, inject } from '@angular/core';
import { NgbToast } from '@ng-bootstrap/ng-bootstrap';
import { ToastInfo, ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-toasts',
  templateUrl: './toast-containter.html',
  standalone: true,
  imports: [NgbToast],
  host: {
    class: 'toast-containter position-fixed top-0 end-0 p-2',
    style: 'z-index: 9001',
  },
})
export class ToastContainer {
  protected readonly toastService = inject(ToastService);

  getClass(severity: ToastInfo['severity']) {
    switch (severity) {
      case 'info':
        return '';
      case 'success':
        return 'bg-success text-light';
      case 'warning':
        return 'bg-warning text-light';
      case 'danger':
        return 'bg-danger text-light';
    }
  }
}
