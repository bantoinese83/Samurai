import React, { useState } from 'react';
import StemWaveform from './StemWaveform';
import { Play, PauseCircle, Music2, Clock, Key, Zap, Download, RotateCcw, SkipBack, SkipForward, Volume, Volume2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from 'react-tooltip';
import toast from 'react-hot-toast';
import TagsDisplay from './TagsDisplay';
import type { Stem, AudioFeatures, GeminiAnalysis } from './types';

interface KatanaPlayerProps {
  stems: Stem[];
  stemVolumes: { [name: string]: number };
  stemMutes: { [name: string]: boolean };
  isPlaying: boolean;
  loading: boolean;
  onPlayAll: () => void;
  onPauseAll: () => void;
  onRestartAll: () => void;
  onStemMute: (name: string) => void;
  onStemVolume: (name: string, value: number) => void;
  waveContainersRef: React.RefObject<{ [name: string]: HTMLDivElement | null }>;
  waveSurfersRef: React.RefObject<{ [name: string]: any }>;
  soloStem: string | null;
  onStemSolo: (name: string) => void;
  stemAnalyses?: { [stemName: string]: AudioFeatures } | null;
  stemGeminiAnalyses?: { [stemName: string]: GeminiAnalysis } | null;
  masterVolume: number;
  onMasterVolume: (value: number) => void;
  stemSizes: { [name: string]: number };
  totalStemsSize: number;
  originalFile: File | null;
}

const KatanaPlayer: React.FC<KatanaPlayerProps> = ({
  stems,
  stemVolumes,
  stemMutes,
  isPlaying,
  loading,
  onPlayAll,
  onPauseAll,
  onRestartAll,
  onStemMute,
  onStemVolume,
  waveContainersRef,
  waveSurfersRef,
  soloStem,
  onStemSolo,
  stemAnalyses,
  stemGeminiAnalyses,
  masterVolume,
  onMasterVolume,
  stemSizes,
  totalStemsSize,
  originalFile,
}) => {
  // Enhanced state management
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(0);

  // Master volume control
  const handleMasterVolumeChange = (value: number) => {
    onMasterVolume(value);
  };

  // Enhanced playback controls
  const handleSeekBackward = () => {
    // Access all WaveSurfer instances from waveSurfersRef
    const waveSurfers = waveSurfersRef.current || {};
    // Find the first available instance to get duration and current time
    const wsArr = Object.values(waveSurfers).filter(Boolean);
    if (wsArr.length === 0) return;
    // Try to get the current time from the first instance
    const firstWS = wsArr[0];
    let newTime = 0;
    if (firstWS && typeof firstWS.getCurrentTime === 'function') {
      newTime = Math.max(0, firstWS.getCurrentTime() - 10);
    } else {
      newTime = Math.max(0, currentTime - 10);
    }
    // Seek all instances
    wsArr.forEach((ws: any) => {
      if (ws && typeof ws.seekTo === 'function' && typeof ws.getDuration === 'function') {
        ws.seekTo(newTime / ws.getDuration());
      }
    });
    setCurrentTime(newTime);
    toast(`Seek to ${newTime.toFixed(1)}s`, { icon: '⏪' });
  };

  const handleSeekForward = () => {
    // Access all WaveSurfer instances from waveSurfersRef
    const waveSurfers = waveSurfersRef.current || {};
    // Find the first available instance to get duration and current time
    const wsArr = Object.values(waveSurfers).filter(Boolean);
    if (wsArr.length === 0) return;
    const firstWS = wsArr[0];
    let newTime = 0;
    let duration = 0;
    if (firstWS && typeof firstWS.getCurrentTime === 'function' && typeof firstWS.getDuration === 'function') {
      duration = firstWS.getDuration();
      newTime = Math.min(duration, firstWS.getCurrentTime() + 10);
    } else {
      newTime = currentTime + 10;
    }
    // Seek all instances
    wsArr.forEach((ws: any) => {
      if (ws && typeof ws.seekTo === 'function' && typeof ws.getDuration === 'function') {
        ws.seekTo(newTime / ws.getDuration());
      }
    });
    setCurrentTime(newTime);
    toast(`Seek to ${newTime.toFixed(1)}s`, { icon: '⏩' });
  };

  // Download all stems as ZIP
  const handleDownloadAll = async () => {
    if (stems.length === 0) return;
    
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      toast.loading('Preparing download...', { id: 'download-all', icon: <Loader2 className="w-5 h-5 animate-spin" /> });
      
      for (const stem of stems) {
        const response = await fetch(stem.url);
        const blob = await response.blob();
        zip.file(`${stem.name}`, blob);
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stems_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('All stems downloaded!', { id: 'download-all', icon: <CheckCircle className="w-5 h-5 text-green-400" /> });
    } catch (err) {
      toast.error('Download failed', { id: 'download-all', icon: <AlertCircle className="w-5 h-5 text-red-400" /> });
      console.error('Download error:', err);
    }
  };

  // Helper functions for stem analysis display
  const getKeyColor = (key: string) => {
    const keyColors: { [key: string]: string } = {
      'C major': '#FF6B6B', 'C minor': '#FF8E8E',
      'C# major': '#FF9F43', 'C# minor': '#FFB366',
      'D major': '#FFA726', 'D minor': '#FFCC80',
      'D# major': '#FFEB3B', 'D# minor': '#FFF176',
      'E major': '#8BC34A', 'E minor': '#AED581',
      'F major': '#4CAF50', 'F minor': '#81C784',
      'F# major': '#26A69A', 'F# minor': '#4DB6AC',
      'G major': '#29B6F6', 'G minor': '#64B5F6',
      'G# major': '#3F51B5', 'G# minor': '#7986CB',
      'A major': '#9C27B0', 'A minor': '#BA68C8',
      'A# major': '#E91E63', 'A# minor': '#F06292',
      'B major': '#F44336', 'B minor': '#EF5350',
    };
    return keyColors[key] || '#9E9E9E';
  };

  const getBpmDescription = (bpm?: number) => {
    if (!bpm) return "Unknown";
    if (bpm < 60) return "Very Slow";
    if (bpm < 80) return "Slow";
    if (bpm < 100) return "Moderate";
    if (bpm < 120) return "Medium";
    if (bpm < 140) return "Fast";
    if (bpm < 160) return "Very Fast";
    return "Extremely Fast";
  };

  const renderStemAnalysis = (stemName: string) => {
    if (!stemAnalyses || !stemAnalyses[stemName] || !stemAnalyses[stemName].analysis_success) {
      return null;
    }

    const analysis = stemAnalyses[stemName];
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="mt-3 bg-black/20 rounded-lg p-3 border border-white/10"
      >
        <div className="mb-3 text-yellow-300 font-bebas text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" strokeWidth={2.2} />
          ENHANCED STEM ANALYSIS
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* BPM with confidence */}
          <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
            <Clock className="w-4 h-4 text-blue-400" strokeWidth={2} />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-semibold text-sm">
                  {analysis.bpm ? `${analysis.bpm} BPM` : 'Unknown'}
                </span>
                {analysis.bpm_confidence && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    analysis.bpm_confidence > 0.8 ? 'bg-green-500/20 text-green-400' :
                    analysis.bpm_confidence > 0.6 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {Math.round(analysis.bpm_confidence * 100)}% confidence
                  </span>
                )}
              </div>
              <div className="text-white/60 text-xs">
                {getBpmDescription(analysis.bpm)}
              </div>
            </div>
          </div>
          
          {/* Key with confidence */}
          <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
            <Key 
              className="w-4 h-4" 
              strokeWidth={2}
              style={{ color: getKeyColor(analysis.key || '') }}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-semibold text-sm">
                  {analysis.key || 'Unknown'}
                </span>
                {analysis.key_confidence && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    analysis.key_confidence > 0.8 ? 'bg-green-500/20 text-green-400' :
                    analysis.key_confidence > 0.6 ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {Math.round(analysis.key_confidence * 100)}% confidence
                  </span>
                )}
              </div>
              <div className="text-white/60 text-xs">
                Musical key signature
              </div>
            </div>
          </div>
          
          {/* Duration */}
          {analysis.duration && (
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
              <Volume2 className="w-4 h-4 text-green-400" strokeWidth={2} />
              <div>
                <div className="text-white font-semibold text-sm">
                  {Math.floor(analysis.duration / 60)}:{(analysis.duration % 60).toFixed(0).padStart(2, '0')}
                </div>
                <div className="text-white/60 text-xs">Duration</div>
              </div>
            </div>
          )}
          
          {/* Dynamic Range */}
          {analysis.dynamic_range && (
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
              <Volume className="w-4 h-4 text-purple-400" strokeWidth={2} />
              <div>
                <div className="text-white font-semibold text-sm">
                  {analysis.dynamic_range.toFixed(3)}
                </div>
                <div className="text-white/60 text-xs">Dynamic Range</div>
              </div>
            </div>
          )}
          
          {/* Spectral Centroid */}
          {analysis.spectral_centroid && (
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
              <Zap className="w-4 h-4 text-cyan-400" strokeWidth={2} />
              <div>
                <div className="text-white font-semibold text-sm">
                  {(analysis.spectral_centroid / 1000).toFixed(1)}kHz
                </div>
                <div className="text-white/60 text-xs">Spectral Centroid</div>
              </div>
            </div>
          )}
          
          {/* Sample Rate */}
          {analysis.sample_rate && (
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
              <Zap className="w-4 h-4 text-orange-400" strokeWidth={2} />
              <div>
                <div className="text-white font-semibold text-sm">
                  {(analysis.sample_rate / 1000).toFixed(1)}kHz
                </div>
                <div className="text-white/60 text-xs">Sample Rate</div>
              </div>
            </div>
          )}
        </div>
        
        {/* Analysis quality indicator */}
        <div className="mt-3 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/50">Analysis Quality:</span>
            <div className="flex items-center gap-1">
              {(analysis.bpm_confidence || 0) > 0.8 && (analysis.key_confidence || 0) > 0.8 ? (
                <>
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-green-400">High</span>
                </>
              ) : (analysis.bpm_confidence || 0) > 0.6 && (analysis.key_confidence || 0) > 0.6 ? (
                <>
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span className="text-yellow-400">Medium</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span className="text-red-400">Low</span>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Add badge style
  const badgeClass = "audio-size-badge inline-block bg-yellow-700/80 text-yellow-100 text-xs font-bold rounded-full px-3 py-1 mr-2 mb-2";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-4xl bg-black/40 border border-white/10 rounded-2xl p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-md flex flex-col items-center"
    >
      <div className="w-full flex items-center justify-start">
        <span className="font-noto text-sm text-yellow-200 mb-2">プレーヤー</span>
      </div>
      {/* Audio size badges */}
      <div className="w-full flex flex-wrap gap-2 mb-4 items-center">
        {originalFile && (
          <span className={badgeClass} title="Original upload size">
            Upload: {(originalFile.size / (1024 * 1024)).toFixed(2)} MB
          </span>
        )}
        {stems.map(stem => (
          <span key={stem.name} className={badgeClass} title={stem.name}>
            {stem.name}: {stemSizes[stem.name] ? (stemSizes[stem.name] / (1024 * 1024)).toFixed(2) + ' MB' : '...'}
          </span>
        ))}
        {stems.length > 0 && (
          <span className={badgeClass + ' bg-yellow-900/80'} title="Total stems size">
            Total: {(totalStemsSize / (1024 * 1024)).toFixed(2)} MB
          </span>
        )}
      </div>

      {/* Enhanced Master Controls */}
      <div className="w-full mb-6 p-4 bg-black/20 rounded-xl border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* Main Play/Pause */}
            <button
              onClick={isPlaying ? onPauseAll : onPlayAll}
              aria-label={isPlaying ? 'Pause all' : 'Play all'}
              className={`p-4 rounded-full bg-gradient-to-br from-red-600 to-yellow-500 hover:brightness-110 transition transform hover:scale-105 ${stems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={loading || stems.length === 0}
              data-tooltip-id="katana-player-tooltip"
              data-tooltip-content={stems.length === 0 ? 'Upload audio to enable playback' : isPlaying ? 'Pause all stems' : 'Play all stems'}
            >
              {isPlaying ? (
                <PauseCircle className="w-8 h-8" strokeWidth={2.2} />
              ) : (
                <Play className="w-8 h-8" strokeWidth={2.2} />
              )}
            </button>

            {/* Transport Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={onRestartAll}
                aria-label="Restart"
                className={`p-2 rounded-lg bg-white/10 hover:bg-white/20 transition ${stems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={stems.length === 0}
                data-tooltip-id="katana-player-tooltip"
                data-tooltip-content="Restart from beginning"
              >
                <RotateCcw className="w-5 h-5" strokeWidth={2.2} />
              </button>
              <button
                onClick={handleSeekBackward}
                aria-label="Seek backward 10s"
                className={`p-2 rounded-lg bg-white/10 hover:bg-white/20 transition ${stems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={stems.length === 0}
                data-tooltip-id="katana-player-tooltip"
                data-tooltip-content="Seek backward 10s"
              >
                <SkipBack className="w-5 h-5" strokeWidth={2.2} />
              </button>
              <button
                onClick={handleSeekForward}
                aria-label="Seek forward 10s"
                className={`p-2 rounded-lg bg-white/10 hover:bg-white/20 transition ${stems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={stems.length === 0}
                data-tooltip-id="katana-player-tooltip"
                data-tooltip-content="Seek forward 10s"
              >
                <SkipForward className="w-5 h-5" strokeWidth={2.2} />
              </button>
            </div>
          </div>
          {/* Master Volume */}
          <div className="flex items-center gap-3">
            <Volume className="w-5 h-5 text-yellow-400" strokeWidth={2.2} />
            <span className="text-sm text-white/70 min-w-[60px]">Master</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={masterVolume}
              onChange={e => handleMasterVolumeChange(Number(e.target.value))}
              className="w-32 h-2 bg-white/10 rounded-full accent-yellow-500 cursor-pointer"
              disabled={stems.length === 0}
              aria-label="Master volume"
            />
            <span className="text-sm text-white/50 min-w-[35px]">{Math.round(masterVolume * 100)}%</span>
          </div>
        </div>
        {/* Remove loop/manual/clear loop UI, keep only download all */}
        <div className="flex items-center justify-end">
          <button
            onClick={handleDownloadAll}
            aria-label="Download all stems"
            className={`px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm shadow flex items-center gap-2 transition transform hover:scale-105 ${stems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={stems.length === 0}
            data-tooltip-id="katana-player-tooltip"
            data-tooltip-content="Download all stems as ZIP"
          >
            <Download className="w-4 h-4" />
            Download All
          </button>
        </div>
      </div>

      {/* Stems */}
      <div className="space-y-6 w-full">
        <AnimatePresence>
          {stems.length > 0 ? (
            stems.map((stem) => (
              <motion.div
                key={stem.name}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
                className="relative"
              >
                <StemWaveform
                  stem={stem}
                  volume={stemVolumes[stem.name] ?? 1}
                  muted={stemMutes[stem.name] ?? false}
                  onMute={() => onStemMute(stem.name)}
                  onVolume={value => onStemVolume(stem.name, value)}
                  waveContainerRef={el => { waveContainersRef.current[stem.name] = el; }}
                  isPlaying={isPlaying}
                  loading={loading}
                  isSolo={soloStem === stem.name}
                >
                  <div className="flex flex-col gap-2 items-center mr-2">
                    <button
                      aria-label={soloStem === stem.name ? `Unsolo ${stem.name}` : `Solo ${stem.name}`}
                      className={`p-1 rounded font-bold text-xs shadow w-8 h-8 flex items-center justify-center transition transform hover:scale-105 ${
                        soloStem === stem.name 
                          ? 'bg-yellow-500 text-black ring-2 ring-yellow-400' 
                          : 'bg-yellow-400/80 text-black hover:bg-yellow-500'
                      }`}
                      data-tooltip-id="katana-player-tooltip"
                      data-tooltip-content={soloStem === stem.name ? 'Unsolo this stem' : 'Solo this stem'}
                      onClick={() => onStemSolo(stem.name)}
                      disabled={loading}
                    >
                      S
                    </button>
                    <a
                      href={stem.url}
                      download={stem.name}
                      aria-label={`Download ${stem.name}`}
                      className="p-1 rounded bg-red-500/80 hover:bg-red-600 text-white font-bold text-xs shadow flex items-center justify-center w-8 h-8 transition transform hover:scale-105"
                      data-tooltip-id="katana-player-tooltip"
                      data-tooltip-content={`Download ${stem.name}`}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </StemWaveform>
                {/* Render stem analysis below the waveform */}
                {renderStemAnalysis(stem.name.replace('.wav', '').replace('.mp3', ''))}
                
                {/* Render Gemini analysis for stem */}
                {stemGeminiAnalyses && stemGeminiAnalyses[stem.name.replace('.wav', '').replace('.mp3', '')] && (
                  <TagsDisplay 
                    geminiAnalysis={stemGeminiAnalyses[stem.name.replace('.wav', '').replace('.mp3', '')]} 
                    className="mt-3" 
                    compact={true}
                  />
                )}
              </motion.div>
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="text-center py-12"
            >
              <div className="flex flex-col items-center gap-4">
                <Music2 className="w-16 h-16 text-white/30" strokeWidth={1.5} />
                <div className="space-y-2">
                  <h3 className="text-lg font-medium text-white/70">Awaiting Audio</h3>
                  <p className="text-sm text-white/50 max-w-sm">
                    Upload an audio file to separate it into individual stems for mixing and playback.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <Tooltip id="katana-player-tooltip" />
    </motion.div>
  );
};

export default KatanaPlayer; 