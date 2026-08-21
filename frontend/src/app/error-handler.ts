import { ErrorHandler, inject } from '@angular/core';
import { ToastService } from './services/toast.service';
import { HttpErrorResponse } from '@angular/common/http';

export class ExceptionHandler implements ErrorHandler {
  private toastService = inject(ToastService);
  handleError(error: any): void {
    // Http errors are handled separately
    if (!(error instanceof HttpErrorResponse))
      this.toastService.show({
        title: 'Fehler',
        text: `Ein unerwarteter Fehler ist aufgetreten: ${error.message ? error.message : error}`,
        severity: 'danger',
      });
    console.error(error);
  }
}
