import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ZusammenfassungFilter } from './text-filter.component';

describe('ZusammenfassungFilter', () => {
  let component: ZusammenfassungFilter;
  let fixture: ComponentFixture<ZusammenfassungFilter>;
  let modal: jasmine.SpyObj<NgbModal>;

  beforeEach(async () => {
    modal = jasmine.createSpyObj('NgbModal', ['open']);

    await TestBed.configureTestingModule({
      imports: [ZusammenfassungFilter],
      providers: [{ provide: NgbModal, useValue: modal }],
    }).compileComponents();
    fixture = TestBed.createComponent(ZusammenfassungFilter);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('name', 'Zusammenfassung');
    fixture.detectChanges();
  });

  it('apply emits undefined when no text is given', () => {
    let emitted: unknown;
    component.filterChanged.subscribe((f) => (emitted = f));

    component.apply();

    expect(component.active()).toBeTrue();
    expect(emitted).toBeUndefined();
  });

  it('apply emits the given text', () => {
    let emitted: unknown;
    component.filterInput = 'hallo';
    component.filterChanged.subscribe((f) => (emitted = f));

    component.apply();

    expect(emitted).toBe('hallo');
  });

  it('cancel resets and emits undefined', () => {
    component.filterInput = 'hallo';
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
