import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { mockMatchMedia } from 'src/app/testing/matchMediaMock';

import { GrowthChartFullscreenModalComponent } from './growth-chart-fullscreen-modal.component';

describe('GrowthChartFullscreenModalComponent', () => {
  let component: GrowthChartFullscreenModalComponent;
  let fixture: ComponentFixture<GrowthChartFullscreenModalComponent>;

  beforeEach(async () => {
    localStorage.removeItem('theme');
    mockMatchMedia(false);

    await TestBed.configureTestingModule({
      imports: [GrowthChartFullscreenModalComponent],
      providers: [
        provideCharts(withDefaultRegisterables()),
        { provide: NgbActiveModal, useValue: jasmine.createSpyObj(['dismiss']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GrowthChartFullscreenModalComponent);
    component = fixture.componentInstance;
    component.child = {
      name: 'Max',
      lastName: 'Muster',
      gender: 'male',
      dateOfBirth: new Date('2024-01-01'),
      healthData: [
        { date: new Date('2024-03-01'), weightKg: 5 },
        { date: new Date('2026-03-01'), weightKg: 13 },
      ],
    } as any;
    component.ageRange = 1;
  });

  afterEach(() => localStorage.removeItem('theme'));

  it('plots the whole 0-3 years', () => {
    fixture.detectChanges();

    const [childData, p97] = component.data().datasets;
    expect(childData.data.length).toBe(2);
    expect((p97.data as { x: number }[]).length).toBe(37);
  });

  it('starts on the selected age range and limits panning to 0-36 months', () => {
    fixture.detectChanges();

    const options = component.options();
    expect(options.scales!['x']!.min).toBe(12);
    expect(options.scales!['x']!.max).toBe(24);
    expect(options.plugins!.zoom!.limits!['x']).toEqual(
      jasmine.objectContaining({ min: 0, max: 36 }),
    );
  });

  it('keeps the y axis limits around the plotted values', () => {
    fixture.detectChanges();

    const y = component.options().plugins!.zoom!.limits!['y']!;
    expect(y.min).toBeLessThanOrEqual(2);
    expect(y.max).toBeGreaterThanOrEqual(18);
  });

  it('resets the zoom', () => {
    fixture.detectChanges();
    const resetZoom = spyOn(component.chart!.chart!, 'resetZoom');

    component.resetZoom();

    expect(resetZoom).toHaveBeenCalled();
  });

  it('exports the visible window as whole months', () => {
    fixture.detectChanges();
    const click = spyOn(HTMLAnchorElement.prototype, 'click');

    component.downloadChart();

    const a = click.calls.mostRecent().object as HTMLAnchorElement;
    expect(a.download).toBe('Max-Muster-Gewicht-12-24-Monate.png');
  });
});
