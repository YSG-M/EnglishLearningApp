/** Injected everywhere "now" matters, so tests can move through days deterministically. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export class FakeClock implements Clock {
  private t: number;
  constructor(start: Date | string) {
    this.t = new Date(start).getTime();
  }
  now(): Date {
    return new Date(this.t);
  }
  set(d: Date | string): void {
    this.t = new Date(d).getTime();
  }
  advanceMs(ms: number): void {
    this.t += ms;
  }
  advanceDays(days: number): void {
    const d = new Date(this.t);
    d.setDate(d.getDate() + days);
    this.t = d.getTime();
  }
}
