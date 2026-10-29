import type { SerializedAppError } from '../errors';

/**
 * What actually crosses IPC. Electron flattens thrown errors into a string, losing the code,
 * so handlers return an envelope and the preload script turns failures back into errors.
 */
export type IpcEnvelope<T = unknown> = { ok: true; value: T } | { ok: false; error: SerializedAppError };
