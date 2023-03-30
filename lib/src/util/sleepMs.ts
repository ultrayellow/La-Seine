export const sleepMs = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(() => resolve(true), ms);
  });
};
