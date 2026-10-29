type SessionNavigator = Navigator & { audioSession?: { type: string } };

export function setAudioSession(type: 'playback' | 'play-and-record'): void {
  try {
    if (typeof navigator !== 'undefined' && (navigator as SessionNavigator).audioSession)
      (navigator as SessionNavigator).audioSession!.type = type;
  } catch {
    // Audio routing is a best-effort hint on browsers which expose this API.
  }
}

let releaseRecording: (() => void) | null = null;
export function registerRecording(stop: (() => void) | null): void {
  releaseRecording = stop;
}
export function stopRecordingForPlayback(): void {
  releaseRecording?.();
}
