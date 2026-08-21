type Primitive = string | number | symbol | bigint | boolean | null | undefined;

export function sortByNumProperty<
  T extends Record<K, N>,
  K extends keyof T,
  N extends number,
>(key: K) {
  return (a: T, b: T) => a[key] - b[key];
}

export function sortByStringProperty<
  T extends Record<K, N>,
  K extends keyof T,
  N extends string,
>(key: K) {
  return (a: T, b: T) => a[key].localeCompare(b[key]);
}

export function isEmptyObject(test: unknown) {
  if (typeof test !== 'object') return false;
  for (const prop in test) {
    if (Object.hasOwn(test, prop)) return false;
  }
  return true;
}

export function unique<T extends Primitive>(
  value: T,
  index: number,
  array: T[],
) {
  return array.indexOf(value) === index;
}
