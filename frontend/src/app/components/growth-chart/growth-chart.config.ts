import { Chart, ChartData, ChartOptions, Plugin } from 'chart.js';
import {
  AgeRange,
  ageInMonths,
  getPercentileDatasets,
  GrowthMetric,
} from 'src/app/util/healthDataUtils';
import { ChildModel as Child } from '../../../../../shared/generated/prisma/models';

/** Inclusive month window shown on the x axis */
export interface MonthRange {
  min: number;
  max: number;
}

// exported images have a fixed size so they don't depend on the on-screen chart
export const EXPORT_WIDTH = 1600;
export const EXPORT_HEIGHT = 1000;

export const metricLabel = (metric: GrowthMetric) =>
  metric === 'weight' ? 'Gewicht' : 'Größe';

/**
 * Plots the child's measurements by age in months, limited to the given window.
 * @param {Child | undefined} child The child to plot
 * @param {GrowthMetric} metric Which measurement to plot
 * @param {MonthRange} range The month window to keep
 * @returns {{ x: number; y: number }[]} The data points
 */
export function getChildData(
  child: Child | undefined,
  metric: GrowthMetric,
  { min, max }: MonthRange,
): { x: number; y: number }[] {
  if (!child) return [];

  return (child.healthData ?? [])
    .map((h) => ({
      x: ageInMonths(new Date(child.dateOfBirth), new Date(h.date)),
      y: metric === 'height' ? h.sizeCm : h.weightKg,
    }))
    .filter(
      (v): v is { x: number; y: number } =>
        v.y != null && v.x >= min && v.x <= max,
    );
}

export function buildGrowthChartData(
  child: Child | undefined,
  ageRange: AgeRange,
  range: MonthRange,
  metric: GrowthMetric,
  theme: 'light' | 'dark',
): ChartData {
  if (!child) return { datasets: [] };
  return {
    datasets: [
      {
        label: child.name,
        borderColor: theme === 'light' ? 'rgba(0,0,0,1)' : 'white',
        spanGaps: true,
        data: getChildData(child, metric, range),
      },
      ...getPercentileDatasets(child.gender, ageRange, metric),
    ],
  };
}

export function buildGrowthChartOptions({ min, max }: MonthRange): ChartOptions {
  return {
    scales: {
      x: {
        type: 'linear',
        min,
        max,
        title: { text: 'Alter (in Monaten)', display: true },
        ticks: { stepSize: 1 },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => {
            const age = (items[0]?.parsed as { x?: number } | undefined)?.x;
            return age != null
              ? `${age.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Monate`
              : '';
          },
        },
      },
    },
  };
}

// chart.js canvases are transparent - paint white behind everything for exports
const whiteBackground: Plugin = {
  id: 'whiteBackground',
  beforeDraw: (chart) => {
    const { ctx } = chart;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

/**
 * Renders the chart off-screen at a fixed size in the light theme with a white background,
 * independent of the size and theme of the chart currently shown.
 * @param {ChartData} data The chart data, built for the light theme
 * @param {MonthRange} range The month window to show
 * @param {string} title The title drawn above the chart
 * @returns {string} The PNG as a data url
 */
export function renderGrowthChartPng(
  data: ChartData,
  range: MonthRange,
  title: string,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;

  const options = buildGrowthChartOptions(range);
  const chart = new Chart(canvas, {
    type: 'line',
    data,
    options: {
      ...options,
      responsive: false,
      animation: false,
      devicePixelRatio: 1,
      color: '#666',
      font: { size: 18 },
      plugins: {
        ...options.plugins,
        title: { display: true, text: title, color: '#212529', font: { size: 24 } },
      },
    },
    plugins: [whiteBackground],
  });
  try {
    return chart.toBase64Image('image/png');
  } finally {
    chart.destroy();
  }
}

export function downloadDataUrl(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
}
