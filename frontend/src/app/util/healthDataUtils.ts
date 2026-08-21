import {
  addMonths,
  differenceInMonths,
  differenceInYears,
  isSameMonth,
} from 'date-fns';
import {
  P_97_BOYS,
  P_97_GIRLS,
  P_85_BOYS,
  P_85_GIRLS,
  P_50_BOYS,
  P_50_GIRLS,
  P_15_BOYS,
  P_15_GIRLS,
  P_03_BOYS,
  P_03_GIRLS,
} from '../../../../shared/consts';
import { ChartDataset } from 'chart.js';
import { Gender } from '../../../../shared/generated/prisma/enums';
import { ChildModel as Child } from '../../../../shared/generated/prisma/models';

/**
 * Returns the datasets for a given percentile chart. The chart is given by the gender and ageRange of the Child
 * @param {Gender} gender The Gender of the child, defaults to female if not explicitly male
 * @param {0 | 1 | 2} ageRange The age range for the Child, 0 is 0-1, 1 is 1-2, 2 is 2-3 years
 * @returns {ChartDataset[]} An array of datasets
 */
export function getPercentileDatasets(
  gender: Gender,
  ageRange: 0 | 1 | 2,
): ChartDataset[] {
  const datasets = [
    {
      label: '97%',
      borderColor: '#ef4444',
      pointStyle: false,
      data:
        gender === Gender.male
          ? P_97_BOYS.slice(0 + ageRange * 12, 11 + ageRange * 12 + 1)
          : P_97_GIRLS.slice(0 + ageRange * 12, 11 + ageRange * 12 + 1),
    },
    {
      label: '85%',
      borderColor: '#f59e0b',
      pointStyle: false,
      data:
        gender === Gender.male
          ? P_85_BOYS.slice(0 + ageRange * 12, 11 + ageRange * 12 + 1)
          : P_85_GIRLS.slice(0 + ageRange * 12, 11 + ageRange * 12 + 1),
    },
    {
      label: '50%',
      borderColor: '#10b981',
      pointStyle: false,
      data:
        gender === Gender.male
          ? P_50_BOYS.slice(0 + ageRange * 12, 11 + ageRange * 12 + 1)
          : P_50_GIRLS.slice(0 + ageRange * 12, 11 + ageRange * 12 + 1),
    },
    {
      label: '15%',
      borderColor: '#f59e0b',
      pointStyle: false,
      data:
        gender === Gender.male
          ? P_15_BOYS.slice(0 + ageRange * 12, 11 + ageRange * 12 + 1)
          : P_15_GIRLS.slice(0 + ageRange * 12, 11 + ageRange * 12 + 1),
    },
    {
      label: '3%',
      borderColor: '#ef4444',
      pointStyle: false,
      data:
        gender === Gender.male
          ? P_03_BOYS.slice(0 + ageRange * 12, 11 + ageRange * 12 + 1)
          : P_03_GIRLS.slice(0 + ageRange * 12, 11 + ageRange * 12 + 1),
    },
  ];
  return datasets;
}

/**
 * Takes the healthData and birthday for a child and the age in months and returns the weight data
 * @param {PrismaJson.HealthDataPointChild[]} healthData The healthData of the Child
 * @param {Date} birthday The birthday of the child
 * @param {number} ageInMonths The age of the child in months
 * @returns {number | null} Returns the weight in kg for the age or null if no data is in the healthData
 */
export function getWeightForMonth(
  healthData: PrismaJson.HealthDataPointChild[],
  birthday: Date,
  ageInMonths: number,
): number | null {
  const date = addMonths(birthday, ageInMonths);
  const dataPoints = healthData.filter((d) =>
    isSameMonth(date, new Date(d.date)),
  );

  if (dataPoints.length === 0) return null;
  if (dataPoints.length === 1) return dataPoints[0].weightKg || null;
  const sum = dataPoints.reduce((prev, cur) => prev + cur.weightKg!, 0);

  return sum / dataPoints.length;
}

/**
 * Helper function to get an age string for a child.
 * @param {Child} child The child.
 * @param {Date} date [optional] An optional date to calculate the date at
 * @returns {strg} The age, expressed in Months or years
 */
export function ageString(child: Child, date?: Date) {
  const ageInYears = differenceInYears(date || new Date(), child.dateOfBirth);
  if (ageInYears >= 3) return `${ageInYears} Jahre`;
  const ageInMonths = differenceInMonths(date || new Date(), child.dateOfBirth);
  return `${ageInMonths} Monate`;
}
