import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { CaseFilter } from './case-filter.component';

describe('CaseFilter', () => {
  let component: CaseFilter;
  let fixture: ComponentFixture<CaseFilter>;
  let modal: jasmine.SpyObj<NgbModal>;

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [CaseFilter],
      providers: [{ provide: NgbModal, useValue: modal }],
    }).compileComponents();
    fixture = TestBed.createComponent(CaseFilter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create inactive', () => {
    expect(component).toBeTruthy();
    expect(component.active()).toBeFalse();
  });

  it('apply emits the built case filter and activates when input is non-empty', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));
    component.filterInput = { city: { filter: 'equals', value: 'Berlin' } };

    component.apply();

    expect(component.active()).toBeTrue();
    expect(emitted).toEqual(jasmine.objectContaining({ city: { equals: 'Berlin' } }));
  });

  it('apply does not activate when the filter input is empty', () => {
    component.apply();

    expect(component.active()).toBeFalse();
  });

  it('cancel resets the filter and emits an empty filter', () => {
    let emitted: unknown;
    component.filterInput = { city: { filter: 'equals', value: 'Berlin' } };
    component.apply();
    component.filterChanged.subscribe((f) => (emitted = f));

    component.cancel();

    expect(component.active()).toBeFalse();
    expect(component.filterInput).toEqual({});
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
