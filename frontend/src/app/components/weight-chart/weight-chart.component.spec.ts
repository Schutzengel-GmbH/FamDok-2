import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { WeightChartComponent } from './weight-chart.component';
import { ThemeService } from 'src/app/services/theme.service';

describe('WeightChartComponent', () => {
  let component: WeightChartComponent;
  let fixture: ComponentFixture<WeightChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeightChartComponent],
      providers: [provideCharts(withDefaultRegisterables())],
    }).compileComponents();

    fixture = TestBed.createComponent(WeightChartComponent);
    component = fixture.componentInstance;
  });

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

  it('shifts the month range with ageRange', () => {
    component.ageRange.set(1);

    expect(component.getMonthArray()).toEqual(
      [...Array(12).keys()].map((n) => n + 12),
    );
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

    expect(component.getChildData().every((v) => v === null)).toBeTrue();
  });
});
