import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { DauerFilter } from './dauer-filter.component';

describe('DauerFilter', () => {
  let component: DauerFilter;
  let fixture: ComponentFixture<DauerFilter>;
  let modal: jasmine.SpyObj<NgbModal>;

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [DauerFilter],
      providers: [{ provide: NgbModal, useValue: modal }],
    }).compileComponents();
    fixture = TestBed.createComponent(DauerFilter);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('name', 'Dauer');
    fixture.detectChanges();
  });

  it('apply emits an empty filter when no input is given', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));

    component.apply();

    expect(component.active()).toBeTrue();
    expect(emitted).toEqual({});
  });

  it('apply emits a gte/lte pair for a range filter', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));
    component.filterInput = { filter: 'range', value: [10, 30] };

    component.apply();

    expect(emitted).toEqual({ gte: 10, lte: 30 });
  });

  it('apply emits a single comparison for a non-range filter', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));
    component.filterInput = { filter: 'gte', value: 15 };

    component.apply();

    expect(emitted).toEqual({ gte: 15 });
  });

  it('cancel resets and emits an empty filter', () => {
    component.filterInput = { filter: 'gte', value: 15 };
    component.apply();
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));

    component.cancel();

    expect(component.active()).toBeFalse();
    expect(emitted).toEqual({});
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
