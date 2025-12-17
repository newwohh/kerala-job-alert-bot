export type RetryOptions = {
  retries: number;
  delayMs?: number;
};

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const retries = Math.max(0, options.retries);
  const delayMs = options.delayMs ?? 500;

  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === retries) break;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  throw lastErr;
}
