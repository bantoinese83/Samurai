import { useRef, useEffect, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';

export function useWaveSurfers(
  stems: Array<{ name: string; url: string }>,
  stemMutes: { [name: string]: boolean },
  stemVolumes: { [name: string]: number },
  onSeek: (progress: number) => void,
  onPlay: () => void,
  onPause: () => void
) {
  const waveSurfers = useRef<{ [name: string]: WaveSurfer | null }>({});
  const waveContainers = useRef<{ [name: string]: HTMLDivElement | null }>({});

  // Memoize callbacks to prevent unnecessary re-renders
  const handleSeek = useCallback((progress: number) => {
    onSeek(progress);
  }, [onSeek]);

  const handlePlay = useCallback(() => {
    onPlay();
  }, [onPlay]);

  const handlePause = useCallback(() => {
    onPause();
  }, [onPause]);

  // Create/update WaveSurfer instances
  useEffect(() => {
    if (stems.length > 0) {
      stems.forEach((stem) => {
        const container = waveContainers.current[stem.name];
        if (container && !waveSurfers.current[stem.name]) {
          try {
            const wavesurfer = WaveSurfer.create({
              container: container,
              waveColor: '#ef4444',
              progressColor: '#fbbf24',
              cursorColor: '#ffffff',
              barWidth: 2,
              barGap: 1,
              height: 48,
              normalize: true,
              mediaControls: false,
              interact: true,
              dragToSeek: true,
            });

            // Load the audio file
            wavesurfer.load(stem.url);

            // Set initial volume and mute state
            const initialVolume = stemMutes[stem.name] ? 0 : (stemVolumes[stem.name] ?? 1);
            wavesurfer.setVolume(initialVolume);

            // Add event listeners
            wavesurfer.on('interaction', handleSeek);
            wavesurfer.on('play', handlePlay);
            wavesurfer.on('pause', handlePause);
            
            // Handle loading errors
            wavesurfer.on('error', (error) => {
              console.error(`Error loading ${stem.name}:`, error);
            });

            waveSurfers.current[stem.name] = wavesurfer;
          } catch (error) {
            console.error(`Error creating WaveSurfer for ${stem.name}:`, error);
            waveSurfers.current[stem.name] = null;
          }
        }
      });
    }

    // Cleanup function
    return () => {
      Object.entries(waveSurfers.current).forEach(([name, ws]) => {
        if (ws && !stems.find(stem => stem.name === name)) {
          ws.destroy();
          delete waveSurfers.current[name];
        }
      });
    };
  }, [stems, handleSeek, handlePlay, handlePause]);

  // Update volume and mute states
  useEffect(() => {
    Object.entries(waveSurfers.current).forEach(([name, ws]) => {
      if (ws) {
        const volume = stemMutes[name] ? 0 : (stemVolumes[name] ?? 1);
        ws.setVolume(volume);
        
        // Update waveform color based on mute state
        const waveColor = stemMutes[name] ? '#555555' : '#ef4444';
        ws.setOptions({ waveColor });
      }
    });
  }, [stemMutes, stemVolumes]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      Object.values(waveSurfers.current).forEach(ws => ws?.destroy());
      waveSurfers.current = {};
    };
  }, []);

  return { waveSurfers, waveContainers };
} 