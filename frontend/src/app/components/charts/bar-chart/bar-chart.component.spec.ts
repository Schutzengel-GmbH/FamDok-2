import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { BarChart } from './bar-chart.component';

describe('BarChart', () => {
  let component: BarChart;
  let fixture: ComponentFixture<BarChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BarChart],
      providers: [provideCharts(withDefaultRegisterables())],
    }).compileComponents();

    fixture = TestBed.createComponent(BarChart);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('datasets', { data: [1, 2, 3], label: 'Cases' });
    fixture.componentRef.setInput('labels', ['Jan', 'Feb', 'Mar']);
    fixture.detectChanges();
  });

  it('composes the chart data from the datasets and labels inputs', () => {
    // Chart.js mutates the dataset in place to fill in style defaults once rendered, so only
    // assert on the fields this component itself is responsible for setting.
    expect(component.data()).toEqual(
      jasmine.objectContaining({
        datasets: [jasmine.objectContaining({ data: [1, 2, 3], label: 'Cases' })],
        labels: ['Jan', 'Feb', 'Mar'],
      }),
    );
  });

  it('is a bar chart with the legend hidden', () => {
    expect(component.type).toBe('bar');
    expect(component.options?.plugins?.legend?.display).toBeFalse();
  });
});
