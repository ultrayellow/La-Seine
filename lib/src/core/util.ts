export function groupBy<T, K extends string>(
  array: readonly T[],
  selector: (el: T) => K,
): Partial<Record<K, T[]>> {
  const ret: Partial<Record<K, T[]>> = {};

  for (const element of array) {
    const key = selector(element);
    const arr = (ret[key] ??= [] as T[]);
    arr.push(element);
  }

  return ret;
}

export function assertGroupBySuccess<T, K extends string>(
  grouped: Partial<Record<K, T[]>>,
): asserts grouped is Record<K, T[]> {
  if (Object.keys(grouped).length === 0) {
    throw new Error('groupBy failed.');
  }
}

export const sleepMs = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(() => resolve(true), ms);
  });
};
