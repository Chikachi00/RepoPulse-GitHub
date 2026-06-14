const millisecondsPerDay = 24 * 60 * 60 * 1000;
const millisecondsPerHour = 60 * 60 * 1000;

function finiteValues(values: number[]): number[] {
  return values.filter((value) => Number.isFinite(value));
}

export function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateAverage(values: number[]): number | null {
  const usableValues = finiteValues(values);

  if (usableValues.length === 0) {
    return null;
  }

  return roundMetric(usableValues.reduce((sum, value) => sum + value, 0) / usableValues.length);
}

export function calculateMedian(values: number[]): number | null {
  const sortedValues = finiteValues(values).sort((left, right) => left - right);

  if (sortedValues.length === 0) {
    return null;
  }

  const midpoint = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return roundMetric(sortedValues[midpoint] ?? 0);
  }

  const left = sortedValues[midpoint - 1] ?? 0;
  const right = sortedValues[midpoint] ?? 0;

  return roundMetric((left + right) / 2);
}

export function calculatePercentile(values: number[], percentile: number): number | null {
  const sortedValues = finiteValues(values).sort((left, right) => left - right);

  if (sortedValues.length === 0) {
    return null;
  }

  if (sortedValues.length === 1) {
    return roundMetric(sortedValues[0] ?? 0);
  }

  const boundedPercentile = Math.min(100, Math.max(0, percentile));
  const index = (boundedPercentile / 100) * (sortedValues.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = sortedValues[lowerIndex] ?? 0;
  const upper = sortedValues[upperIndex] ?? lower;

  return roundMetric(lower + (upper - lower) * (index - lowerIndex));
}

export function calculateAgeInDays(date: string, now: Date): number | null {
  const timestamp = Date.parse(date);

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  const age = Math.floor((now.getTime() - timestamp) / millisecondsPerDay);
  return Math.max(0, age);
}

export function calculateDurationInHours(start: string, end: string): number | null {
  const startTimestamp = Date.parse(start);
  const endTimestamp = Date.parse(end);

  if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp)) {
    return null;
  }

  const duration = (endTimestamp - startTimestamp) / millisecondsPerHour;

  if (duration < 0) {
    return null;
  }

  return roundMetric(duration);
}
