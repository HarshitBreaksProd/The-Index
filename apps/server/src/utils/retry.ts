export async function retry<T>(
  fn: () => Promise<T>,
  retries = 1,
  delay = 500
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.log(`[RETRY] Operation failed. Retrying in ${delay}ms...`);
      await new Promise((res) => setTimeout(res, delay));
      return retry(fn, retries - 1, delay);
    }
    throw error;
  }
}
