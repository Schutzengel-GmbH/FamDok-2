import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { DateFilterContact } from './date-filter.component';

describe('DateFilterContact', () => {
  let component: DateFilterContact;
  let fixture: ComponentFixture<DateFilterContact>;
  let modal: jasmine.SpyObj<NgbModal>;

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [DateFilterContact],
      providers: [{ provide: NgbModal, useValue: modal }],
    }).compileComponents();
    fixture = TestBed.createComponent(DateFilterContact);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('name', 'Datum');
    fixture.detectChanges();
  });

  it('apply activates and emits the current filter input', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));
    const date = new Date('2026-01-01');
    component.filterInput = { filter: 'gte', value: date };

    component.apply();

    expect(component.active()).toBeTrue();
    expect(emitted).toEqual({ filter: 'gte', value: date });
  });

  it('cancel resets and emits undefined', () => {
    component.filterInput = { filter: 'gte', value: new Date() };
    component.apply();
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));

    component.cancel();

    expect(component.active()).toBeFalse();
    expect(component.filterInput).toBeUndefined();
    expect(emitted).toBeUndefined();
  });

  describe('open', () => {
    it('applies the filter when the modal resolves with "apply"', async () => {
      modal.open.and.returnValue({ result: Promise.resolve('apply') } as any);
      const applySpy = spyOn(component, 'apply');

      component.open({} as any);
      await fixture.whenStable();

      expect(applySpy).toHaveBeenCalled();
    });

    it('cancels the filter when the modal resolves with anything else', async () => {
      modal.open.and.returnValue({ result: Promise.resolve('dismiss') } as any);
      const cancelSpy = spyOn(component, 'cancel');

      component.open({} as any);
      await fixture.whenStable();

      expect(cancelSpy).toHaveBeenCalled();
    });
  });
});
