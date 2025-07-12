import React from 'react';
import { UploadCloud, FileAudio, CheckCircle, AlertCircle, Download, Music2, Play, PauseCircle, Clock, Key, Volume2, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from 'react-tooltip';
import WaveSurfer from 'wavesurfer.js';
import TagsDisplay from './TagsDisplay';
import type { AudioFeatures, GeminiAnalysis } from './types';

interface BladeUploadProps {
  file: File | null;
  loading: boolean;
  progress: number;
  progressMessage: string;
  error: string | null;
  success: boolean;
  downloadUrl: string | null;
  audioFeatures: AudioFeatures | null;
  geminiAnalysis: GeminiAnalysis | null;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onUpload: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}

const BladeUpload: React.FC<BladeUploadProps> = ({
  file,
  loading,
  progress,
  progressMessage,
  error,
  success,
  downloadUrl,
  audioFeatures,
  geminiAnalysis,
  onFileChange,
  onDrop,
  onDragOver,
  onUpload,
  inputRef,
}) => {
  // --- Audio preview state ---
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = React.useState(false);
  const [previewVolume, setPreviewVolume] = React.useState(1);
  const previewWaveRef = React.useRef<HTMLDivElement | null>(null);
  const previewWaveSurfer = React.useRef<WaveSurfer | null>(null);

  // Generate object URL for preview
  React.useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file]);

  // Setup WaveSurfer for preview
  React.useEffect(() => {
    if (previewUrl && previewWaveRef.current) {
      if (previewWaveSurfer.current) {
        previewWaveSurfer.current.destroy();
        previewWaveSurfer.current = null;
      }
      const ws = WaveSurfer.create({
        container: previewWaveRef.current,
        waveColor: '#ef4444',
        progressColor: '#fbbf24',
        cursorColor: '#fff',
        barWidth: 2,
        barRadius: 1,
        height: 48,
        normalize: true,
        backend: 'WebAudio',
        mediaControls: false,
      });
      ws.load(previewUrl);
      ws.setVolume(previewVolume);
      ws.on('play', () => setIsPreviewPlaying(true));
      ws.on('pause', () => setIsPreviewPlaying(false));
      previewWaveSurfer.current = ws;
      return () => {
        ws.destroy();
        previewWaveSurfer.current = null;
      };
    }
  }, [previewUrl, previewVolume]);

  // Sync volume
  React.useEffect(() => {
    if (previewWaveSurfer.current) {
      previewWaveSurfer.current.setVolume(previewVolume);
    }
  }, [previewVolume]);

  // Pause preview on upload
  React.useEffect(() => {
    if (loading && previewWaveSurfer.current) {
      previewWaveSurfer.current.pause();
    }
  }, [loading]);

  // --- Preview player UI ---
  const renderPreview = () =>
    file && previewUrl ? (
      <div className="w-full mt-8 mb-2">
        <div className="mb-2 text-yellow-300 font-bebas text-lg flex items-center gap-2">
          <Music2 className="w-5 h-5 text-yellow-400" strokeWidth={2.2} />
          AUDIO PREVIEW
        </div>
        <div className="w-full bg-black/30 rounded-xl p-4 flex flex-col items-center border border-white/10">
          <div className="flex items-center gap-4 mb-2">
            <button
              onClick={() => {
                if (previewWaveSurfer.current) {
                  if (isPreviewPlaying) previewWaveSurfer.current.pause();
                  else previewWaveSurfer.current.play();
                }
              }}
              aria-label={isPreviewPlaying ? 'Pause preview' : 'Play preview'}
              className="p-2 rounded-full bg-gradient-to-br from-red-600 to-yellow-500 hover:brightness-110 transition"
            >
              {isPreviewPlaying ? <PauseCircle className="w-6 h-6" strokeWidth={2.2} /> : <Play className="w-6 h-6" strokeWidth={2.2} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={previewVolume}
              onChange={e => setPreviewVolume(Number(e.target.value))}
              className="w-32 h-2 bg-white/10 rounded-full accent-red-500 cursor-pointer"
              aria-label="Preview volume"
            />
          </div>
          <div ref={previewWaveRef} className="w-full h-12 bg-neutral-900 rounded" />
        </div>
      </div>
    ) : null;

  // --- Audio Features Display ---
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
    if (!bpm) return "Unknown tempo";
    if (bpm < 60) return "Very Slow";
    if (bpm < 80) return "Slow";
    if (bpm < 100) return "Moderate";
    if (bpm < 120) return "Medium";
    if (bpm < 140) return "Fast";
    if (bpm < 160) return "Very Fast";
    return "Extremely Fast";
  };

  const renderAudioFeatures = () =>
    audioFeatures && audioFeatures.analysis_success ? (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full mt-6 bg-black/20 rounded-xl p-4 border border-white/10"
      >
        <div className="mb-3 text-yellow-300 font-bebas text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" strokeWidth={2.2} />
          AUDIO ANALYSIS
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* BPM */}
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
            <Clock className="w-5 h-5 text-blue-400" strokeWidth={2} />
            <div>
              <div className="text-white font-semibold text-lg">
                {audioFeatures.bpm ? `${audioFeatures.bpm} BPM` : 'Unknown'}
              </div>
              <div className="text-white/60 text-sm">
                {getBpmDescription(audioFeatures.bpm)}
              </div>
            </div>
          </div>
          
          {/* Key */}
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
            <Key 
              className="w-5 h-5" 
              strokeWidth={2}
              style={{ color: getKeyColor(audioFeatures.key || '') }}
            />
            <div>
              <div className="text-white font-semibold text-lg">
                {audioFeatures.key || 'Unknown'}
              </div>
              <div className="text-white/60 text-sm">
                {audioFeatures.key_confidence 
                  ? `${(audioFeatures.key_confidence * 100).toFixed(0)}% confidence`
                  : 'No confidence data'
                }
              </div>
            </div>
          </div>
          
          {/* Duration */}
          {audioFeatures.duration && (
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <Volume2 className="w-5 h-5 text-green-400" strokeWidth={2} />
              <div>
                <div className="text-white font-semibold text-lg">
                  {Math.floor(audioFeatures.duration / 60)}:{(audioFeatures.duration % 60).toFixed(0).padStart(2, '0')}
                </div>
                <div className="text-white/60 text-sm">Duration</div>
              </div>
            </div>
          )}
          
          {/* Sample Rate */}
          {audioFeatures.sample_rate && (
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
              <Zap className="w-5 h-5 text-purple-400" strokeWidth={2} />
              <div>
                <div className="text-white font-semibold text-lg">
                  {(audioFeatures.sample_rate / 1000).toFixed(1)}kHz
                </div>
                <div className="text-white/60 text-sm">Sample Rate</div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    ) : null;

  const SamuraiSword = ({ className = "" }: { className?: string }) => (
    <div className={`sword ${className}`}>
      <div className="blade"></div>
      <div className="guard"></div>
      <div className="handle">
        <div className="wrap"></div>
        <div className="wrap"></div>
        <div className="wrap"></div>
        <div className="wrap"></div>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-xl bg-black/40 border border-white/10 rounded-2xl p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-md flex flex-col items-center">
      <div className="w-full flex items-center justify-start">
        <span className="font-noto text-sm text-yellow-200 mb-2">アップロード</span>
      </div>
      {/* Drop zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.4 }}
        className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 hover:border-red-500/50 transition h-52 cursor-pointer overflow-hidden w-full max-w-md ${loading ? 'opacity-60 pointer-events-none' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onClick={() => inputRef.current?.click()}
        aria-label="Audio file drop zone"
        data-tooltip-id="blade-upload-tooltip"
        data-tooltip-content="Click or drag audio file here"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-white/0 to-white/5 group-hover:from-red-500/10"></div>
        <UploadCloud className="relative z-10 w-16 h-16 text-white/50 group-hover:text-red-400 transition mb-3 animate-pulse" strokeWidth={1.5} />
        <p className="relative z-10 text-base text-white/60"><span className="underline">Summon</span> or drag & drop audio</p>
        <input
          type="file"
          accept="audio/*"
          onChange={onFileChange}
          ref={inputRef}
          className="sr-only"
          aria-label="Upload audio"
        />
      </motion.div>
      <Tooltip id="blade-upload-tooltip" />
      {/* Audio preview before upload */}
      {renderPreview()}
      
      {/* Audio Features Display */}
      {renderAudioFeatures()}
      
      {/* Gemini AI Analysis Display */}
      {geminiAnalysis && <TagsDisplay geminiAnalysis={geminiAnalysis} className="mt-6" />}
      
      {/* ACTIVE JOB & PROGRESS */}
      <AnimatePresence>
        {file && (
          <motion.div
            key="file-info"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="mt-10 w-full space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileAudio className="w-5 h-5 text-red-500" strokeWidth={2} />
                <p className="text-sm font-medium">{file.name}</p>
              </div>
              <p className="text-sm text-white/60">{loading ? `${progress}%` : success ? '100%' : '0%'}</p>
            </div>
            {/* Processing Section */}
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 p-6 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700"
              >
                <div className="flex items-center gap-4 mb-4">
                  {/* <SamuraiSword className="animate-spin-slow" /> Removed sword icon */}
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {progressMessage || 'Sharpening the blade...'}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      This may take a few minutes depending on file size
                    </p>
                  </div>
                </div>

                {/* Unified Progress Bar */}
                <div className="relative w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                  {/* Background glow */}
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-red-500/20 to-yellow-500/20 animate-pulse" />
                  
                  {/* Flowing gradient background */}
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 opacity-30 animate-flow"
                    style={{
                      backgroundSize: '200% 100%',
                    }}
                  />
                  
                  {/* Main progress fill */}
                  <motion.div
                    className="relative h-full bg-gradient-to-r from-orange-400 via-red-500 to-yellow-400 shadow-lg"
                    style={{
                      width: `${progress}%`,
                      boxShadow: '0 0 20px rgba(251, 146, 60, 0.8), 0 0 40px rgba(239, 68, 68, 0.6)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    {/* Pulsing glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-300 via-red-400 to-yellow-300 animate-pulse opacity-60" />
                    
                    {/* Sword tip at the end removed */}
                  </motion.div>
                </div>

                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-400">
                    {progress}% complete
                  </span>
                  <span className="text-sm text-orange-400 font-medium">
                    {/* ETA is not directly available in the current progress, so this will be empty */}
                  </span>
                </div>

                {/* Audio Features Display */}
                {audioFeatures && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-gray-600"
                  >
                    <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <SamuraiSword className="w-4 h-4" />
                      Audio Analysis
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-400">{audioFeatures.bpm}</div>
                        <div className="text-xs text-gray-400">BPM</div>
                        <div className="text-xs text-gray-500">{getBpmDescription(audioFeatures.bpm)}</div>
                      </div>
                      <div className="text-center">
                        <div 
                          className="text-2xl font-bold mb-1"
                          style={{ color: getKeyColor(audioFeatures.key || '') }}
                        >
                          {audioFeatures.key || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-400">Key</div>
                        <div className="text-xs text-gray-500">
                          {audioFeatures.key_confidence 
                            ? `${(audioFeatures.key_confidence * 100).toFixed(0)}% confidence`
                            : 'No confidence data'
                          }
                        </div>
                      </div>
                                             <div className="text-center">
                         <div className="text-2xl font-bold text-blue-400">
                           {audioFeatures.duration ? 
                             `${Math.floor(audioFeatures.duration / 60)}:${(audioFeatures.duration % 60).toFixed(0).padStart(2, '0')}` 
                             : '--:--'
                           }
                         </div>
                         <div className="text-xs text-gray-400">Duration</div>
                       </div>
                       <div className="text-center">
                         <div className="text-2xl font-bold text-green-400">
                           {audioFeatures.sample_rate ? 
                             `${(audioFeatures.sample_rate / 1000).toFixed(1)}kHz` 
                             : '--'
                           }
                         </div>
                         <div className="text-xs text-gray-400">Sample Rate</div>
                       </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Fun confetti or emoji when done */}
            <AnimatePresence>
              {success && downloadUrl && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center gap-2"
                >
                  <CheckCircle className="w-7 h-7 text-green-400 animate-bounce" />
                  <a
                    href={downloadUrl}
                    download="separated_stems.zip"
                    className="underline text-green-400 font-bold flex items-center gap-1"
                    aria-label="Download separated stems"
                    data-tooltip-id="blade-upload-tooltip"
                    data-tooltip-content="Download all stems as ZIP"
                  >
                    <Download className="w-5 h-5" /> Download Separated Stems
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                  className="text-red-400 text-center font-semibold mt-2 flex items-center justify-center gap-2"
                  aria-live="assertive"
                  data-tooltip-id="blade-upload-tooltip"
                  data-tooltip-content="Error occurred"
                >
                  <AlertCircle className="w-5 h-5" />{error}
                </motion.div>
              )}
            </AnimatePresence>
            {/* Upload button only if not loading */}
            {!loading && (
              <button
                className="mt-4 w-full py-2 rounded-lg bg-gradient-to-r from-red-500 via-yellow-400 to-yellow-300 text-black font-bold shadow hover:brightness-110 transition disabled:opacity-60 flex items-center justify-center gap-2"
                onClick={onUpload}
                disabled={loading || !file}
                aria-label="Upload and separate audio"
                data-tooltip-id="blade-upload-tooltip"
                data-tooltip-content={loading ? 'Processing...' : 'Upload and separate'}
              >
                <UploadCloud className="w-5 h-5" /> Upload & Separate
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BladeUpload; 