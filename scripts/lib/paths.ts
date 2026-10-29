import { join } from 'node:path';
import { ROOT } from './content-files';

/** Build outputs and model locations; must match docs/02-architecture.md §3.3. */
export const RESOURCES_DIR = join(ROOT, 'resources');
export const BUNDLE_FILE = join(RESOURCES_DIR, 'content', 'bundle.json');
export const AUDIO_DIR = join(RESOURCES_DIR, 'audio');
export const WHISPER_DIR = join(RESOURCES_DIR, 'models', 'whisper-base.en');
export const DEV_MODELS_DIR = join(ROOT, '.models');
export const KOKORO_DIR = join(DEV_MODELS_DIR, 'kokoro-en-v0_19');
