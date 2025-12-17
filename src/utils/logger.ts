function ts(): string {
  return new Date().toISOString();
}

export function log(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log(ts(), ...args);
}

export function warn(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.warn(ts(), ...args);
}

export function error(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.error(ts(), ...args);
}
