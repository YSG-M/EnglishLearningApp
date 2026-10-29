import { Settings, defaultSettings } from '../../../shared/settings';
import type { Database } from '../database';

/**
 * Stored as one JSON row. Parsing through the zod schema fills in defaults for settings added
 * in later versions and drops invalid values instead of failing to start.
 */
export class SettingsRepository {
  constructor(private readonly db: Database) {}

  get(): Settings {
    const r = this.db.get<{ value: string }>('SELECT value FROM settings WHERE id = 1');
    if (!r) return { ...defaultSettings };
    let stored: unknown;
    try {
      stored = JSON.parse(r.value);
    } catch {
      return { ...defaultSettings };
    }
    const parsed = Settings.safeParse(stored);
    if (parsed.success) return parsed.data;
    // Keep each valid field; reset only the broken ones.
    const out: Record<string, unknown> = { ...defaultSettings };
    if (stored && typeof stored === 'object') {
      for (const [k, v] of Object.entries(stored)) {
        const one = Settings.safeParse({ ...defaultSettings, [k]: v });
        if (one.success) out[k] = v;
      }
    }
    return Settings.parse(out);
  }

  set(s: Settings): void {
    this.db.run(
      'INSERT INTO settings (id, value) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET value = excluded.value',
      JSON.stringify(s),
    );
  }
}
