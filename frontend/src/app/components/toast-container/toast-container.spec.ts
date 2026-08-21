import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgbToast } from '@ng-bootstrap/ng-bootstrap';

import { ToastContainer } from './toast-container';
import { ToastService } from 'src/app/services/toast.service';

describe('ToastContainer', () => {
  let component: ToastContainer;
  let fixture: ComponentFixture<ToastContainer>;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastContainer],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastContainer);
    component = fixture.componentInstance;
    toastService = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  it('renders no toasts initially', () => {
    expect(toastService.toasts().length).toBe(0);
    expect(fixture.debugElement.queryAll(By.directive(NgbToast)).length).toBe(0);
  });

  it('renders a toast pushed onto the service with its header and text', () => {
    toastService.show({ title: 'Gespeichert', text: 'Alles gut', severity: 'success' });
    fixture.detectChanges();

    const toastEls = fixture.debugElement.queryAll(By.directive(NgbToast));
    expect(toastEls.length).toBe(1);
    expect(toastEls[0].nativeElement.textContent).toContain('Alles gut');
    expect((toastEls[0].componentInstance as NgbToast).header).toBe('Gespeichert');
  });

  it('renders multiple toasts, one ngb-toast per entry', () => {
    toastService.show({ title: 'A', text: 'a', severity: 'info' });
    toastService.show({ title: 'B', text: 'b', severity: 'warning' });
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.directive(NgbToast)).length).toBe(2);
  });

  it('uses the given delay, or defaults to 5000ms when not set', () => {
    toastService.show({ title: 'A', text: 'a', severity: 'info', delay: 1234 });
    toastService.show({ title: 'B', text: 'b', severity: 'info' });
    fixture.detectChanges();

    const toastEls = fixture.debugElement.queryAll(By.directive(NgbToast));
    expect((toastEls[0].componentInstance as NgbToast).delay).toBe(1234);
    expect((toastEls[1].componentInstance as NgbToast).delay).toBe(5000);
  });

  it('removes a toast from the service when it fires "hidden"', () => {
    const toastInfo = { title: 'A', text: 'a', severity: 'info' as const };
    toastService.show(toastInfo);
    fixture.detectChanges();

    const toastEl = fixture.debugElement.query(By.directive(NgbToast));
    toastEl.triggerEventHandler('hidden', undefined);

    expect(toastService.toasts().length).toBe(0);
  });

  describe('getClass', () => {
    it('maps each severity to the expected bootstrap classes', () => {
      expect(component.getClass('info')).toBe('');
      expect(component.getClass('success')).toBe('bg-success text-light');
      expect(component.getClass('warning')).toBe('bg-warning text-light');
      expect(component.getClass('danger')).toBe('bg-danger text-light');
    });
  });
});
