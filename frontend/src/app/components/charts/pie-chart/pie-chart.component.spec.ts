import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { PieChart } from './pie-chart.component';

describe('PieChart', () => {
  let component: PieChart;
  let fixture: ComponentFixture<PieChart>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PieChart],
      providers: [provideCharts(withDefaultRegisterables())],
    }).compileComponents();

    fixture = TestBed.createComponent(PieChart);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('datasets', { data: [1, 2, 3] });
    fixture.componentRef.setInput('labels', ['A', 'B', 'C']);
    fixture.detectChanges();
  });

  it('composes the chart data from the datasets and labels inputs', () => {
    // Chart.js mutates the dataset in place to fill in style defaults once rendered, so only
    // assert on the fields this component itself is responsible for setting.
    expect(component.data()).toEqual(
      jasmine.objectContaining({
        datasets: [jasmine.objectContaining({ data: [1, 2, 3] })],
        labels: ['A', 'B', 'C'],
      }),
    );
  });

  it('is a pie chart with the legend shown', () => {
    expect(component.type).toBe('pie');
    expect(component.options?.plugins?.legend?.display).toBeTrue();
  });
});
