import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ThemenFilter } from './themen-filter.component';

describe('ThemenFilter', () => {
  let component: ThemenFilter;
  let fixture: ComponentFixture<ThemenFilter>;
  let modal: jasmine.SpyObj<NgbModal>;

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [ThemenFilter],
      providers: [{ provide: NgbModal, useValue: modal }],
    }).compileComponents();
    fixture = TestBed.createComponent(ThemenFilter);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('prop', 'artDerBetreuung');
    fixture.detectChanges();
  });

  it('exposes the options for the configured prop', () => {
    expect(component.options().length).toBeGreaterThan(0);
  });

  it('apply deactivates and emits undefined when no option is selected', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));

    component.apply();

    expect(component.active()).toBeFalse();
    expect(emitted).toBeUndefined();
  });

  it('apply activates and emits the selected option id', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));
    component.filterInput = component.options()[0];

    component.apply();

    expect(component.active()).toBeTrue();
    expect(emitted).toBe(component.options()[0].id);
  });

  it('cancel resets and emits undefined', () => {
    component.filterInput = component.options()[0];
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
