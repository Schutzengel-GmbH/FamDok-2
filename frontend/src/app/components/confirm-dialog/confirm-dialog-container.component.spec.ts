import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { ConfirmDialogContainer } from './confirm-dialog-container.component';
import { ConfirmDialogService } from 'src/app/services/confirm-dialog.service';

describe('ConfirmDialogContainer', () => {
  let component: ConfirmDialogContainer;
  let fixture: ComponentFixture<ConfirmDialogContainer>;
  let dialogService: ConfirmDialogService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogContainer],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogContainer);
    component = fixture.componentInstance;
    dialogService = TestBed.inject(ConfirmDialogService);
    fixture.detectChanges();
  });

  it('renders nothing when there are no open dialogs', () => {
    expect(dialogService.openDialogs().length).toBe(0);
    expect(fixture.debugElement.query(By.css('.modal'))).toBeNull();
  });

  it('renders a dialog with the title and text passed to the service', () => {
    dialogService.open({
      title: 'Löschen?',
      text: 'Wirklich löschen?',
      confirmAction: () => {},
    });
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.css('.modal'));
    expect(modal).not.toBeNull();
    expect(modal.nativeElement.textContent).toContain('Löschen?');
    expect(modal.nativeElement.textContent).toContain('Wirklich löschen?');
  });

  it('renders one modal block per open dialog', () => {
    dialogService.open({ title: 'A', text: 'a', confirmAction: () => {} });
    dialogService.open({ title: 'B', text: 'b', confirmAction: () => {} });
    fixture.detectChanges();

    const modals = fixture.debugElement.queryAll(By.css('.modal'));
    expect(modals.length).toBe(2);
  });

  it('clicking the cancel button invokes cancelAction and removes the dialog', () => {
    const cancelAction = jasmine.createSpy('cancelAction');
    dialogService.open({
      title: 'Löschen?',
      text: 'Wirklich löschen?',
      confirmAction: () => {},
      cancelAction,
    });
    fixture.detectChanges();

    const cancelBtn = fixture.debugElement.query(By.css('.btn-secondary'));
    cancelBtn.nativeElement.click();

    expect(cancelAction).toHaveBeenCalled();
    expect(dialogService.openDialogs().length).toBe(0);
  });

  it('clicking the close (x) button also invokes cancelAction', () => {
    const cancelAction = jasmine.createSpy('cancelAction');
    dialogService.open({
      title: 'Löschen?',
      text: 'Wirklich löschen?',
      confirmAction: () => {},
      cancelAction,
    });
    fixture.detectChanges();

    const closeBtn = fixture.debugElement.query(By.css('.btn-close'));
    closeBtn.nativeElement.click();

    expect(cancelAction).toHaveBeenCalled();
    expect(dialogService.openDialogs().length).toBe(0);
  });

  it('clicking the confirm button invokes confirmAction and removes the dialog, leaving others open', () => {
    const confirmAction = jasmine.createSpy('confirmAction');
    dialogService.open({ title: 'A', text: 'a', confirmAction });
    dialogService.open({ title: 'B', text: 'b', confirmAction: () => {} });
    fixture.detectChanges();

    const confirmBtn = fixture.debugElement.query(By.css('.btn-primary'));
    confirmBtn.nativeElement.click();
    fixture.detectChanges();

    expect(confirmAction).toHaveBeenCalled();
    expect(dialogService.openDialogs().length).toBe(1);
    expect(dialogService.openDialogs()[0].title).toBe('B');
  });
});
