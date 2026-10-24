import { useEffect, useState } from 'react';
import { player } from '../audio/player';

/** The id of whatever is playing right now (null when silent). */
export function usePlayingId(): string | null {
  const [id, setId] = useState<string | null>(player.current);
  useEffect(() => player.subscribe(setId), []);
  return id;
}

/** Stops playback when the screen unmounts, so audio never continues on the next page. */
export function useStopAudioOnUnmount(): void {
  useEffect(() => () => player.stop(), []);
}
