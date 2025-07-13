import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Star, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface StemWaveformProps {
  stem: { name: string; url: string };
  volume: number;
  muted: boolean;
  onMute: () => void;
  onVolume: (value: number) => void;
  waveContainerRef: (el: HTMLDivElement | null) => void;
  isPlaying: boolean;
  loading: boolean;
  isSolo?: boolean;
  children?: React.ReactNode;
}

const StemWaveform: React.FC<StemWaveformProps> = ({
  stem,
  volume,
  muted,
  onMute,
  onVolume,
  waveContainerRef,
  isPlaying,
  loading,
  isSolo,
  children,
}) => {
  const [waveformLoading, setWaveformLoading] = useState(true);
  const [waveformError, setWaveformError] = useState<string | null>(null);
  const [containerReady, setContainerReady] = useState(false);

  // Handle container ref assignment
  const handleContainerRef = (el: HTMLDivElement | null) => {
    waveContainerRef(el);
    setContainerReady(!!el);
  };

  // Reset loading state when stem changes
  useEffect(() => {
    setWaveformLoading(true);
    setWaveformError(null);
    
    // Simulate waveform loading completion
    const timer = setTimeout(() => {
      setWaveformLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [stem.url]);

  return (
    <div className={`flex flex-col gap-2 w-full ${isSolo ? 'ring-2 ring-yellow-400 bg-yellow-400/5 rounded-lg p-2' : ''}`}>
      <div className="flex items-center gap-4 w-full">
        {/* Button group on the left */}
        {children && <div className="flex flex-col gap-2 items-center">{children}</div>}
        
        {/* Mute/Unmute button */}
        <div className="flex flex-col items-center justify-center mr-2">
          <span className="text-xs text-white/50 mb-1">{Math.round(volume * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={e => onVolume(Number(e.target.value))}
            className="h-24 w-2 bg-white/10 rounded-full accent-red-500 cursor-pointer vertical-slider"
            style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' }}
            disabled={loading}
            aria-label={`Volume for ${stem.name}`}
            data-tooltip-id="stem-tooltip"
            data-tooltip-content={`Volume: ${Math.round(volume * 100)}%`}
          />
          <button
            onClick={onMute}
            aria-label={muted ? `Unmute ${stem.name}` : `Mute ${stem.name}`}
            className={`mt-2 p-2 rounded-lg hover:bg-white/5 transition-colors ${muted ? 'bg-red-500/20' : 'bg-transparent'}`}
            disabled={loading}
            data-tooltip-id="stem-tooltip"
            data-tooltip-content={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? (
              <VolumeX className="w-5 h-5 text-red-400" strokeWidth={2.2} />
            ) : (
              <Volume2 className="w-5 h-5 text-yellow-400" strokeWidth={2.2} />
            )}
          </button>
        </div>

        {/* Stem name */}
        <div className="flex-1 text-sm flex items-center gap-2">
          <span className="font-medium text-white">
            {stem.name.replace(/\.(wav|mp3)$/i, '')}
          </span>
          {isSolo && (
            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-400/20 rounded-full">
              <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
              <span className="text-xs text-yellow-400 font-medium">SOLO</span>
            </div>
          )}
        </div>
      </div>

      {/* Waveform container */}
      <div className="relative w-full">
        <motion.div
          ref={handleContainerRef}
          className={`w-full h-12 bg-neutral-900/80 rounded-lg relative overflow-hidden ${
            isPlaying && !muted ? 'shadow-[0_0_16px_4px_rgba(255,215,64,0.3)]' : ''
          }`}
          style={{ 
            opacity: muted ? 0.5 : 1,
            transition: 'opacity 0.3s ease'
          }}
          animate={
            isPlaying && !muted 
              ? { 
                  boxShadow: '0 0 24px 8px rgba(255, 187, 36, 0.4)',
                  borderColor: 'rgba(255, 187, 36, 0.6)'
                } 
              : { 
                  boxShadow: '0 0 0 0 rgba(0, 0, 0, 0)',
                  borderColor: 'rgba(255, 255, 255, 0.1)'
                }
          }
          transition={{ duration: 0.3 }}
        >
          {/* Loading overlay */}
          {(waveformLoading || loading) && (
            <div className="absolute inset-0 bg-neutral-900/90 flex items-center justify-center">
              <div className="flex items-center gap-2 text-white/70">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Loading waveform...</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {waveformError && (
            <div className="absolute inset-0 bg-red-900/20 flex items-center justify-center">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs">Failed to load waveform</span>
              </div>
            </div>
          )}

          {/* Placeholder when no container */}
          {!containerReady && !waveformLoading && !waveformError && (
            <div className="absolute inset-0 flex items-center justify-center text-white/30">
              <span className="text-xs">Waveform will appear here</span>
            </div>
          )}
        </motion.div>

        {/* Playback position indicator */}
        {isPlaying && !muted && (
          <div className="absolute top-0 left-0 w-1 h-12 bg-yellow-400 rounded-full opacity-80 animate-pulse" />
        )}
      </div>

      {/* Debug info (only in development) */}
      {import.meta.env.DEV ? (
        <div className="text-xs text-white/30 mt-1">
          Container: {containerReady ? 'Ready' : 'Not ready'} | 
          Loading: {waveformLoading ? 'Yes' : 'No'} |
          Error: {waveformError || 'None'}
        </div>
      ) : null}
    </div>
  );
};

export default StemWaveform; 