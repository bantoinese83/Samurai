import WaveSurfer from 'wavesurfer.js';

export function resetUIState(
  setDownloadUrl: (url: string | null) => void,
  setError: (err: string | null) => void,
  setSuccess: (s: boolean) => void,
  setJobCompleted: (jc: boolean) => void,
  setStems: (s: any[]) => void,
  setProgress: (p: number) => void,
  setProgressMessage: (m: string) => void,
  waveSurfers: { [name: string]: WaveSurfer | null },
  eventSourceRef: { current: EventSource | null },
  setAudioFeatures?: (af: any) => void,
  setStemAnalyses?: (sa: any) => void
) {
  setDownloadUrl(null);
  setError(null);
  setSuccess(false);
  setJobCompleted(false);
  setStems([]);
  setProgress(0);
  setProgressMessage('');
  if (setAudioFeatures) setAudioFeatures(null);
  if (setStemAnalyses) setStemAnalyses(null);
  Object.values(waveSurfers).forEach(ws => ws?.destroy());
  Object.keys(waveSurfers).forEach(k => { waveSurfers[k] = null; });
  if (eventSourceRef.current) {
    eventSourceRef.current.close();
    eventSourceRef.current = null;
  }
}

export function handleSeek(progress: number | undefined, waveSurfers: { [name: string]: WaveSurfer | null }) {
  const safeProgress = typeof progress === 'number' ? progress : 0;
  Object.values(waveSurfers).forEach(ws => {
    if (ws) ws.seekTo(safeProgress);
  });
} 