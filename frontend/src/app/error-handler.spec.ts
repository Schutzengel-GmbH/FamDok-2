import { TestBed } from '@angular/core/testing';
import { ErrorHandler } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { ExceptionHandler } from './error-handler';
import { ToastService } from './services/toast.service';

describe('ExceptionHandler', () => {
  let handler: ExceptionHandler;
  let toast: ToastService;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: ErrorHandler, useClass: ExceptionHandler }],
    });

    handler = TestBed.inject(ErrorHandler) as ExceptionHandler;
    toast = TestBed.inject(ToastService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('shows a toast with the error message for a regular error', () => {
    handler.handleError(new Error('Boom'));

    expect(toast.toasts()[0]).toEqual(
      jasmine.objectContaining({
        title: 'Fehler',
        text: jasmine.stringContaining('Boom'),
        severity: 'danger',
      }),
    );
  });

  it('shows a toast with the error itself when it has no message', () => {
    handler.handleError('a plain string error');

    expect(toast.toasts()[0].text).toContain('a plain string error');
  });

  it('does not show a toast for HttpErrorResponse errors', () => {
    handler.handleError(new HttpErrorResponse({ status: 500 }));

    expect(toast.toasts().length).toBe(0);
  });

  it('always logs the error to the console', () => {
    const error = new Error('Boom');
    handler.handleError(error);

    expect(consoleErrorSpy).toHaveBeenCalledWith(error);
  });
});
