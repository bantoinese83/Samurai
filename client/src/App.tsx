import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import './App.css';
import BladeUpload from './BladeUpload';
import KatanaPlayer from './KatanaPlayer';
import { useWaveSurfers } from './hooks/useWaveSurfers';
import { resetUIState, handleSeek } from './utils/audio';
import { uploadAndTrackSeparation } from './api/audioSeparation';
import toast, { Toaster } from 'react-hot-toast';
import { CheckCircle, AlertCircle } from 'lucide-react';
import type { ProgressData, GeminiAnalysis, AudioFeatures, Stem } from './types';
import samuraiLogo from './assets/logo/samurai-logo-v1-removebg.png';

function App() {
  // --- State Management ---
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [stems, setStems] = useState<Stem[]>([]);
  const [stemVolumes, setStemVolumes] = useState<{[name: string]: number}>({});
  const [stemMutes, setStemMutes] = useState<{[name: string]: boolean}>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1);
  // --- New state for solo/unsolo ---
  const [soloStem, setSoloStem] = useState<string | null>(null);
  // --- Store job_id from upload response ---
  const [, setCurrentJobId] = useState<string | null>(null);
  // --- Audio features state ---
  const [audioFeatures, setAudioFeatures] = useState<AudioFeatures | null>(null);
  // --- Gemini analysis state ---
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiAnalysis | null>(null);
  // --- Stem analyses state ---
  const [stemAnalyses, setStemAnalyses] = useState<{ [stemName: string]: AudioFeatures } | null>(null);
  // --- Stem Gemini analyses state ---
  const [stemGeminiAnalyses] = useState<{ [stemName: string]: GeminiAnalysis } | null>(null);
  // --- Onboarding overlay state ---
  // const [showOnboarding, setShowOnboarding] = useState<boolean>(false); // TODO: Enable when onboarding overlay is implemented
  const [stemSizes, setStemSizes] = useState<{ [name: string]: number }>({});
  const [totalStemsSize, setTotalStemsSize] = useState<number>(0);

  // --- Refs for DOM and WaveSurfer instances ---
  const inputRef = useRef<HTMLInputElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // --- WaveSurfer management via custom hook ---
  const { waveSurfers, waveContainers } = useWaveSurfers(
    stems,
    stemMutes,
    stemVolumes,
    (progress) => handleSeek(progress, waveSurfers.current),
    () => setIsPlaying(true),
    () => {
      const allPaused = Object.values(waveSurfers.current).every(ws => ws ? !ws.isPlaying() : true);
      if (allPaused) setIsPlaying(false);
    }
  );

  // --- File Input Handlers ---
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      resetUIState(
        setDownloadUrl,
        setError,
        setSuccess,
        () => {}, // removed setJobCompleted
        setStems,
        setProgress,
        setProgressMessage,
        waveSurfers.current,
        eventSourceRef,
        setAudioFeatures,
        setStemAnalyses
      );
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      resetUIState(
        setDownloadUrl,
        setError,
        setSuccess,
        () => {}, // removed setJobCompleted
        setStems,
        setProgress,
        setProgressMessage,
        waveSurfers.current,
        eventSourceRef,
        setAudioFeatures,
        setStemAnalyses
      );
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  // --- Upload and Separation Logic ---
  async function handleUpload() {
    if (!file) {
      setError('Please select an audio file.');
      toast.error('Please select an audio file.', { icon: <AlertCircle className="w-5 h-5 text-red-400" /> });
      return;
    }
    setLoading(true);
    setProgress(0);
    setProgressMessage('Uploading file...');
    setError(null);
    setDownloadUrl(null);
    setSuccess(false);
    setStems([]);
    setCurrentJobId(null);
    setAudioFeatures(null);
    setStemAnalyses(null);

    // First get the job ID from the upload
    const result = await uploadAndTrackSeparation(file, () => {}, () => {});
    if (!result.jobId) {
      setLoading(false);
      setError('Failed to start separation job.');
      toast.error('Failed to start separation job.');
      return;
    }

    // Set the job ID immediately
    setCurrentJobId(result.jobId);
    const jobId = result.jobId;

    // Now create the progress callback that uses the jobId directly
    const onProgress = (data: ProgressData) => {
      setProgress(data.progress || 0);
      setProgressMessage(data.message || '');
      
      // Update audio features if available
      if (data.audio_features) {
        setAudioFeatures(data.audio_features);
      }
      
      // Update stem analyses if available
      if (data.stem_analyses) {
        setStemAnalyses(data.stem_analyses);
      }

      if (data.gemini_analysis) {
        setGeminiAnalysis(data.gemini_analysis);
      }
      
      if (data.status === 'completed') {
        setError(null);
        setLoading(false);
        setSuccess(true);
        setProgress(100);
        setProgressMessage('Audio separation completed!');
        toast.success('Audio separation completed!', { icon: <CheckCircle className="w-5 h-5 text-green-400" /> });
        // Use the jobId directly from the closure, not from state
        fetch(`http://localhost:5001/download/${jobId}`)
          .then(res => {
            if (!res.ok) throw new Error('Download failed');
            return res.blob();
          })
          .then(async (blob) => {
            const url = window.URL.createObjectURL(blob);
            setDownloadUrl(url);
            // Extract stems from zip
            const zip = await JSZip.loadAsync(blob);
            const newStems: Stem[] = [];
            const sizes: { [name: string]: number } = {};
            let total = 0;
            for (const name of Object.keys(zip.files)) {
              if (name.endsWith('.wav') || name.endsWith('.mp3')) {
                const stemBlob = await zip.files[name].async('blob');
                newStems.push({ name, url: URL.createObjectURL(stemBlob) });
                sizes[name] = stemBlob.size;
                total += stemBlob.size;
              }
            }
            setStems(newStems);
            setStemSizes(sizes);
            setTotalStemsSize(total);
            // Set default volumes and mutes
            const vols: {[name: string]: number} = {};
            const mutes: {[name: string]: boolean} = {};
            newStems.forEach(stem => { vols[stem.name] = 1; mutes[stem.name] = false; });
            setStemVolumes(vols);
            setStemMutes(mutes);
            setSoloStem(null);
          })
          .catch((err) => {
            console.error('Download error:', err);
            setError('Failed to download separated stems.');
            toast.error('Failed to download separated stems.');
          });
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      } else if (data.status === 'error') {
        setLoading(false);
        setError(data.message || 'An error occurred during processing.');
        toast.error(data.message || 'An error occurred during processing.');
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      }
    };

    const onError = (err: string) => {
      setLoading(false);
      setError(err);
      toast.error(err);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    // Start the progress tracking with the actual callbacks
    const eventSource = new EventSource(`http://localhost:5001/progress/${jobId}`);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress(data);
      } catch {
        onError('Error parsing SSE data');
      }
    };
    eventSource.onerror = () => {
      onError('Connection lost. Please try again.');
      eventSource.close();
    };
    eventSourceRef.current = eventSource;
  }

  // --- Volume and Mute Handlers ---
  function handleStemVolume(name: string, value: number) {
    setStemVolumes(prev => ({ ...prev, [name]: value }));
    
    // Immediately update the WaveSurfer instance if it exists
    const waveSurfer = waveSurfers.current[name];
    if (waveSurfer) {
      try {
        // Don't set volume if stem is muted
        const isMuted = stemMutes[name] ?? false;
        const actualVolume = isMuted ? 0 : value * masterVolume;
        waveSurfer.setVolume(actualVolume);
      } catch (error) {
        console.error(`Error setting volume for ${name}:`, error);
      }
    }
  }

  function handleStemMute(name: string) {
    setStemMutes(prev => {
      const newMutes = { ...prev };
      newMutes[name] = !prev[name];
      
      // Immediately update the WaveSurfer instance if it exists
      const waveSurfer = waveSurfers.current[name];
      if (waveSurfer) {
        try {
          const volume = newMutes[name] ? 0 : (stemVolumes[name] ?? 1) * masterVolume;
          waveSurfer.setVolume(volume);
          
          // Update visual feedback
          const waveColor = newMutes[name] ? '#555555' : '#ef4444';
          waveSurfer.setOptions({ waveColor });
        } catch (error) {
          console.error(`Error toggling mute for ${name}:`, error);
        }
      }
      
      // Clear solo if muting the solo stem
      if (newMutes[name] && soloStem === name) {
        setSoloStem(null);
      }
      
      return newMutes;
    });
  }

  // --- Master Volume Handler ---
  function handleMasterVolume(value: number) {
    setMasterVolume(value);
    
    // Update all WaveSurfer instances
    Object.entries(waveSurfers.current).forEach(([name, waveSurfer]) => {
      if (waveSurfer) {
        try {
          const isMuted = stemMutes[name] ?? false;
          const stemVolume = stemVolumes[name] ?? 1;
          const actualVolume = isMuted ? 0 : stemVolume * value;
          waveSurfer.setVolume(actualVolume);
        } catch (error) {
          console.error(`Error updating master volume for ${name}:`, error);
        }
      }
    });
  }

  // --- Solo/Unsolo Logic ---
  function handleStemSolo(name: string) {
    setSoloStem(prev => {
      if (prev === name) {
        // Unsolo: restore all stems to their previous mute state
        setStemMutes(m => {
          const newMutes = { ...m };
          // Restore previous mute states (assuming they were stored)
          Object.keys(newMutes).forEach(stemName => {
            newMutes[stemName] = false; // For now, unmute all
          });
          return newMutes;
        });
        return null;
      } else {
        // Solo this stem: mute all others, unmute this one
        setStemMutes(m => {
          const newMutes = { ...m };
          Object.keys(newMutes).forEach(stemName => {
            newMutes[stemName] = stemName !== name;
          });
          
          // Update WaveSurfer instances immediately
          Object.entries(waveSurfers.current).forEach(([stemName, waveSurfer]) => {
            if (waveSurfer) {
              try {
                const shouldMute = stemName !== name;
                const volume = shouldMute ? 0 : (stemVolumes[stemName] ?? 1) * masterVolume;
                waveSurfer.setVolume(volume);
                
                // Update visual feedback
                const waveColor = shouldMute ? '#555555' : '#ef4444';
                waveSurfer.setOptions({ waveColor });
              } catch (error) {
                console.error(`Error updating solo for ${stemName}:`, error);
              }
            }
          });
          
          return newMutes;
        });
        return name;
      }
    });
  }

  // --- Play/Pause Logic ---
  function handlePlayAll() {
    const wavesurferInstances = Object.values(waveSurfers.current).filter(ws => ws !== null);
    
    if (wavesurferInstances.length === 0) {
      console.warn('No WaveSurfer instances available');
      return;
    }

    try {
      // Ensure all instances are at the same position before playing
      const firstInstance = wavesurferInstances[0];
      if (firstInstance) {
        const currentTime = firstInstance.getCurrentTime();
        wavesurferInstances.forEach(ws => {
          if (ws && Math.abs(ws.getCurrentTime() - currentTime) > 0.1) {
            ws.seekTo(currentTime / ws.getDuration());
          }
        });
      }
      
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing all stems:', error);
    }
  }

  function handlePauseAll() {
    const wavesurferInstances = Object.values(waveSurfers.current).filter(ws => ws !== null);
    
    try {
      // Immediately pause all instances
      wavesurferInstances.forEach(ws => {
        if (ws && ws.isPlaying()) {
          ws.pause();
        }
      });
      
      setIsPlaying(false);
    } catch (error) {
      console.error('Error pausing all stems:', error);
    }
  }

  // --- Restart Logic ---
  function handleRestartAll() {
    const wavesurferInstances = Object.values(waveSurfers.current).filter(ws => ws !== null);
    
    if (wavesurferInstances.length === 0) {
      console.warn('No WaveSurfer instances available');
      return;
    }

    try {
      // Seek all instances to the beginning
      wavesurferInstances.forEach(ws => {
        if (ws) {
          ws.seekTo(0);
        }
      });
      
      // Start playing after a short delay to ensure all are synced
      setTimeout(() => {
        setIsPlaying(true);
      }, 100);
    } catch (error) {
      console.error('Error restarting all stems:', error);
    }
  }

  // --- Enhanced Sync play/pause for all stems ---
  React.useEffect(() => {
    const wavesurferInstances = Object.values(waveSurfers.current).filter(ws => ws !== null);
    
    if (wavesurferInstances.length === 0) return;

    const syncPlayback = async () => {
      try {
        if (isPlaying) {
          // Play all instances that aren't already playing
          const promises = wavesurferInstances.map(ws => {
            if (ws && !ws.isPlaying()) {
              return ws.play();
            }
            return Promise.resolve();
          });
          
          await Promise.all(promises);
        } else {
          // Pause all instances that are playing
          wavesurferInstances.forEach(ws => {
            if (ws && ws.isPlaying()) {
              ws.pause();
            }
          });
        }
      } catch (error) {
        console.error('Error syncing playback:', error);
        // If sync fails, reset playing state
        setIsPlaying(false);
      }
    };

    syncPlayback();
  }, [isPlaying, waveSurfers]);

  // --- Periodic sync check to prevent drift ---
  React.useEffect(() => {
    if (!isPlaying) return;

    const syncInterval = setInterval(() => {
      const wavesurferInstances = Object.values(waveSurfers.current).filter(ws => ws !== null);
      
      if (wavesurferInstances.length <= 1) return;

      try {
        // Find the furthest ahead instance
        const times = wavesurferInstances.map(ws => ws ? ws.getCurrentTime() : 0);
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);
        
        // If there's more than 0.2 seconds of drift, resync
        if (maxTime - minTime > 0.2) {
          console.log('Resyncing stems due to drift');
          wavesurferInstances.forEach(ws => {
            if (ws) {
              ws.seekTo(maxTime / ws.getDuration());
            }
          });
        }
      } catch (error) {
        console.error('Error during sync check:', error);
      }
    }, 2000); // Check every 2 seconds

    return () => clearInterval(syncInterval);
  }, [isPlaying, waveSurfers]);

  // --- UI Rendering ---
  return (
    <div className="min-h-screen font-inter text-neutral-100 bg-neutral-950 bg-daw-pattern bg-cover bg-center relative overflow-x-hidden">
      <Toaster position="top-center" />
      {/* Seigaiha (wave) SVG background pattern */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-10">
        <svg width="100%" height="100%" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="seigaiha" patternUnits="userSpaceOnUse" width="120" height="60">
              <path d="M0 60 Q30 0 60 60 T120 60" stroke="#fff" strokeWidth="2" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#seigaiha)" />
        </svg>
      </div>
      {/* Crimson sun & golden haze */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-red-600/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-yellow-400/15 rounded-full blur-2xl"></div>
      </div>
      {/* DAW-Style Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-neutral-800 bg-gradient-to-r from-neutral-900/90 to-neutral-800/80 shadow-lg">
        <h1 className="flex items-center gap-3 select-none text-2xl md:text-3xl font-bebas tracking-tight text-yellow-400">
          <img src={samuraiLogo} alt="Samurai Logo" className="h-20 w-auto" style={{ display: 'inline-block' }} />
          <span className="text-yellow-500">SAMURAI</span> <span className="text-neutral-200"></span>
        </h1>
        <span className="font-noto text-base text-yellow-300 hidden sm:inline">音楽工房</span>
      </header>
      {/* DAW Main Tracks */}
      <main className="flex flex-row w-full max-w-[98vw] mx-auto gap-8 h-[90vh] min-h-[600px]">
        {/* Blade Upload Left */}
        <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex flex-col items-start justify-center px-6 pt-6 pb-2">
            <h2 className="text-base font-bold tracking-widest text-yellow-300 uppercase flex items-center gap-2 mb-2">
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col items-center">
            <BladeUpload
              file={file}
              loading={loading}
              progress={progress}
              progressMessage={progressMessage}
              error={error}
              success={success}
              downloadUrl={downloadUrl}
              audioFeatures={audioFeatures}
              geminiAnalysis={geminiAnalysis}
              onFileChange={handleFileChange}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onUpload={handleUpload}
              inputRef={inputRef as React.RefObject<HTMLInputElement>}
            />
          </div>
        </section>
        {/* Katana Player Right */}
        <section className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex flex-col items-start justify-center px-6 pt-6 pb-2">
            <h2 className="text-base font-bold tracking-widest text-yellow-400 uppercase flex items-center gap-2 mb-2">
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col items-center">
            <KatanaPlayer
              stems={stems}
              stemVolumes={stemVolumes}
              stemMutes={stemMutes}
              isPlaying={isPlaying}
              loading={loading}
              onPlayAll={handlePlayAll}
              onPauseAll={handlePauseAll}
              onRestartAll={handleRestartAll}
              onStemMute={handleStemMute}
              onStemVolume={handleStemVolume}
              waveContainersRef={waveContainers}
              waveSurfersRef={waveSurfers}
              soloStem={soloStem}
              onStemSolo={handleStemSolo}
              stemAnalyses={stemAnalyses}
              stemGeminiAnalyses={stemGeminiAnalyses}
              masterVolume={masterVolume}
              onMasterVolume={handleMasterVolume}
              stemSizes={stemSizes}
              totalStemsSize={totalStemsSize}
              originalFile={file}
            />
          </div>
        </section>
      </main>
      <footer className="w-full bg-neutral-900/95 border-t border-neutral-800 py-4 flex items-center justify-center shadow-daw-track mt-4">
        <img src={samuraiLogo} alt="Samurai Logo" className="h-16 w-auto mr-3" style={{ display: 'inline-block' }} />
        <span className="text-yellow-400 font-bebas text-lg tracking-wide">© 2025 Samurai. All rights reserved.</span>
      </footer>
      {/* FONTS & DAW BG */}
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Noto+Serif+JP:wght@400;500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet" />
      <style>{`
        .font-bebas{font-family:'Bebas Neue',cursive;}
        .font-noto{font-family:'Noto Serif JP',serif;}
        .font-inter{font-family:'Inter',Arial,sans-serif;}
        .shadow-daw-track{box-shadow:0 2px 12px 0 rgba(0,0,0,0.12);}
        .bg-daw-pattern{background-image:linear-gradient(135deg,rgba(30,30,40,0.95) 60%,rgba(40,40,50,0.95) 100%);}
        input[type=range]{appearance:none;height:4px;border-radius:9999px}
        input[type=range]::-webkit-slider-thumb{appearance:none;width:14px;height:14px;background:#ef4444;border-radius:9999px;cursor:pointer;transition:.2s}
        input[type=range]:hover::-webkit-slider-thumb{background:#f87171}
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 2s linear infinite;
        }
        @keyframes bounce-x {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(10px); }
        }
        .animate-bounce-x {
          animation: bounce-x 1s infinite;
        }
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 2s linear infinite;
        }
        .animate-progress-gradient {
          background-size: 300% 100%;
          animation: progress-gradient-move 2s linear infinite;
        }
        @keyframes progress-gradient-move {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        .animate-progress-bar-glow {
          filter: drop-shadow(0 0 12px #fbbf24) drop-shadow(0 0 24px #ef4444);
        }
        .animate-neon-glow {
          background: radial-gradient(ellipse at center, #fbbf24 0%, #ef4444 80%, transparent 100%);
          opacity: 0.25;
          animation: neon-glow-pulse 1.2s alternate infinite;
        }
        @keyframes neon-glow-pulse {
          0% { opacity: 0.15; }
          100% { opacity: 0.35; }
        }
        .animate-katana-spin {
          animation: katana-spin 1.2s linear infinite;
          transform-origin: 50% 50%;
        }
        @keyframes katana-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-katana-glow {
          animation: katana-glow-pulse 1.2s alternate infinite;
        }
        @keyframes katana-glow-pulse {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .animate-sparkle {
          animation: sparkle-move 0.7s linear infinite alternate;
        }
        @keyframes sparkle-move {
          0% { opacity: 0.7; transform: translateY(0); }
          100% { opacity: 0.2; transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

export default App;
