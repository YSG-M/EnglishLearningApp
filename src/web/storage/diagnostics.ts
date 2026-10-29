export class LocalDiagnostics {
  private lines: { at: string; level: string; event: string }[] = [];
  constructor() {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('kaikou-local-log') ?? '[]');
      if (Array.isArray(saved))
        this.lines = saved
          .filter(
            (r): r is (typeof this.lines)[number] =>
              r && typeof r.at === 'string' && typeof r.level === 'string' && typeof r.event === 'string',
          )
          .slice(-200);
    } catch {
      /* Diagnostics must not block learning. */
    }
  }
  write(level: string, message: string): void {
    // Arbitrary renderer text/meta may contain transcripts or names: retain only a category.
    const event = /storage|quota|backup/i.test(message)
      ? 'storage-event'
      : /speech|audio|record/i.test(message)
        ? 'audio-event'
        : 'app-event';
    this.lines.push({
      at: new Date().toISOString(),
      level: ['info', 'warn', 'error'].includes(level) ? level : 'info',
      event,
    });
    this.lines = this.lines.slice(-200);
    try {
      localStorage.setItem('kaikou-local-log', JSON.stringify(this.lines));
    } catch {
      /* A full log store cannot block saving. */
    }
  }
  blob(): Blob {
    return new Blob([JSON.stringify({ format: 'kaikou-diagnostics', version: 1, events: this.lines })], {
      type: 'application/json',
    });
  }
}
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
