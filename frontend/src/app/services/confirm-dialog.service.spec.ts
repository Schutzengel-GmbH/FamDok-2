import { TestBed } from '@angular/core/testing';

import { ConfirmDialogService } from './confirm-dialog.service';

describe('ConfirmDialogService', () => {
  let service: ConfirmDialogService;

  beforeEach(() => {
    service = TestBed.inject(ConfirmDialogService);
  });

  it('starts with no open dialogs', () => {
    expect(service.openDialogs()).toEqual([]);
  });

  it('opens a dialog with the given title/text and a default style', () => {
    service.open({ title: 'Löschen?', text: 'Wirklich?', confirmAction: () => {} });

    expect(service.openDialogs().length).toBe(1);
    expect(service.openDialogs()[0]).toEqual(
      jasmine.objectContaining({ title: 'Löschen?', text: 'Wirklich?', style: 'default' }),
    );
  });

  it('runs the confirm action and closes the dialog', () => {
    const confirmAction = jasmine.createSpy('confirmAction');
    service.open({ title: 'Löschen?', text: 'Wirklich?', confirmAction });

    service.openDialogs()[0].confirmAction();

    expect(confirmAction).toHaveBeenCalled();
    expect(service.openDialogs()).toEqual([]);
  });

  it('runs the cancel action and closes the dialog', () => {
    const cancelAction = jasmine.createSpy('cancelAction');
    service.open({
      title: 'Löschen?',
      text: 'Wirklich?',
      confirmAction: () => {},
      cancelAction,
    });

    service.openDialogs()[0].cancelAction();

    expect(cancelAction).toHaveBeenCalled();
    expect(service.openDialogs()).toEqual([]);
  });

  it('closing without a cancel action does not throw', () => {
    service.open({ title: 'Löschen?', text: 'Wirklich?', confirmAction: () => {} });

    expect(() => service.openDialogs()[0].cancelAction()).not.toThrow();
    expect(service.openDialogs()).toEqual([]);
  });
});
