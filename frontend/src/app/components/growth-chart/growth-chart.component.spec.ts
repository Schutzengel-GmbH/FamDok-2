import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { GrowthChartComponent } from './growth-chart.component';
import { ThemeService } from 'src/app/services/theme.service';

describe('GrowthChartComponent', () => {
  let component: GrowthChartComponent;
  let fixture: ComponentFixture<GrowthChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrowthChartComponent],
      providers: [provideCharts(withDefaultRegisterables())],
    }).compileComponents();

    fixture = TestBed.createComponent(GrowthChartComponent);
    component = fixture.componentInstance;
  });

  // 'uses a white border color in dark theme' below toggles the real, unmocked ThemeService,
  // which persists to the real localStorage - without this, that leaks into any other spec
  // file relying on no theme being saved (e.g. theme.service.spec.ts).
  afterEach(() => localStorage.removeItem('theme'));

  it('has no datasets when no child is selected', () => {
    fixture.detectChanges();

    expect(component.data().datasets).toEqual([]);
  });

  it('builds a dataset for the selected child', () => {
    fixture.componentRef.setInput('child', {
      name: 'Max',
      gender: 'male',
      dateOfBirth: new Date('2024-01-01'),
      healthData: [],
    } as any);
    fixture.detectChanges();

    expect(component.data().datasets.length).toBeGreaterThan(0);
    expect(component.data().datasets[0].label).toBe('Max');
  });

  it('shifts the x axis month range with ageRange', () => {
    component.ageRange.set(1);

    const x = component.options().scales!['x']!;
    expect(x.min).toBe(12);
    expect(x.max).toBe(24);
  });

  it('getChildData plots measurements by age in months within the age range', () => {
    fixture.componentRef.setInput('child', {
      name: 'Max',
      gender: 'male',
      dateOfBirth: new Date('2024-01-15'),
      healthData: [
        { date: new Date('2024-04-15'), weightKg: 6 },
        { date: new Date('2025-04-15'), weightKg: 10 },
        { date: new Date('2024-05-15'), sizeCm: 60 },
      ],
    } as any);
    fixture.detectChanges();

    const data = component.getChildData();
    expect(data.length).toBe(1);
    expect(data[0].x).toBeCloseTo(3, 0);
    expect(data[0].y).toBe(6);
  });

  it('uses a white border color in dark theme', () => {
    TestBed.inject(ThemeService).toggle();
    fixture.componentRef.setInput('child', {
      name: 'Max',
      gender: 'male',
      dateOfBirth: new Date('2024-01-01'),
      healthData: [],
    } as any);
    fixture.detectChanges();

    expect((component.data().datasets[0] as any).borderColor).toBe('white');
  });

  it('getChildData returns an empty array when no child is selected', () => {
    fixture.detectChanges();

    expect(component.getChildData()).toEqual([]);
  });

  it('getChildData treats a missing healthData array as empty', () => {
    fixture.componentRef.setInput('child', {
      name: 'Max',
      gender: 'male',
      dateOfBirth: new Date('2024-01-01'),
      healthData: undefined,
    } as any);
    fixture.detectChanges();

    expect(component.getChildData()).toEqual([]);
  });
});
