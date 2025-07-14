import React, { useEffect, useState, useRef } from "react";
import { supabase } from "./supabaseClient";
import type { StemVaultEntry, GeminiAnalysis, AudioFeatures } from "./types";
import StemWaveform from "./StemWaveform";
import {
  Play,
  PauseCircle,
  Star,
  StarOff,
  BadgePlus,
  Download,
  CheckSquare,
  Square,
  Search,
  Filter,
  Sparkles,
  ArrowUpDown,
  Heart,
  Mic,
  Drum,
  Music2,
  Shapes,
  BookOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import samuraiLogo from "./assets/logo/samurai-logo-v1-removebg.png";
import SamuraiGlitchText from "./SamuraiGlitchText";
// Replace lodash import with direct groupBy implementation to avoid dependency issues:
// import _ from "lodash";
function groupBy<T, K extends keyof any>(array: T[], getKey: (item: T) => K): Record<K, T[]> {
  return array.reduce((result: Record<K, T[]>, item: T) => {
    const key = getKey(item);
    (result[key] = result[key] || []).push(item);
    return result;
  }, {} as Record<K, T[]>);
}

const formatBytes = (bytes?: number | null) => {
  if (!bytes) {
    return "0 B";
  }
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

const SKELETON_COUNT = 4;
const RECENT_UPLOAD_MINUTES = 60 * 24; // 24 hours

// Add helper to extract gemini_analysis from analysis
function hasGeminiAnalysis(
  obj: unknown
): obj is { gemini_analysis: GeminiAnalysis } {
  return typeof obj === "object" && obj !== null && "gemini_analysis" in obj;
}
function getGeminiAnalysis(
  analysis: AudioFeatures | null | undefined
): GeminiAnalysis | null {
  if (!analysis) {
    return null;
  }
  if (hasGeminiAnalysis(analysis)) {
    return analysis.gemini_analysis;
  }
  // fallback: if analysis itself is GeminiAnalysis
  if (
    typeof analysis === "object" &&
    "tags" in analysis &&
    "description" in analysis &&
    "transcription" in analysis
  ) {
    return analysis as GeminiAnalysis;
  }
  return null;
}

const SAMURAI_QUOTES = [
  { text: 'Even the mightiest sword was once a piece of iron.', author: 'Samurai Proverb' },
  { text: 'Fall seven times, stand up eight.', author: 'Japanese Proverb' },
  { text: 'The way of the Samurai is found in death.', author: 'Yamamoto Tsunetomo' },
  { text: 'Perceive that which cannot be seen with the eye.', author: 'Miyamoto Musashi' },
  { text: 'A samurai, even when he has not eaten, uses his toothpick.', author: 'Japanese Saying' },
  { text: 'To know ten thousand things, know one well.', author: 'Miyamoto Musashi' },
  { text: 'The sword has to be more than a simple weapon; it has to be an answer to life’s questions.', author: 'Miyamoto Musashi' },
  { text: 'Control your anger. If you are angry, you cannot think clearly.', author: 'Samurai Maxim' },
  { text: 'The samurai’s soul is in his sword.', author: 'Japanese Proverb' },
];

export const StemVault: React.FC<{
  onStatsUpdate?: (stats: {
    count: number;
    totalSize: number;
    uniqueUsers: number;
  }) => void;
}> = ({ onStatsUpdate }) => {
  const [stems, setStems] = useState<StemVaultEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size" | "bpm">(
    "date"
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const waveformRefs = useRef<{ [id: string]: HTMLDivElement | null }>({});
  const gridRef = useRef<HTMLDivElement>(null);
  const [skeletons] = useState(Array(SKELETON_COUNT).fill(0));
  const [volumes, setVolumes] = useState<{ [id: string]: number }>({});
  const handleVolumeChange = (id: string, value: number) => {
    setVolumes((v) => ({ ...v, [id]: value }));
  };
  const [expandedNames, setExpandedNames] = useState<{ [id: string]: boolean }>({});
  const [showFullFeaturedName, setShowFullFeaturedName] = useState(false);
  const [quoteIdx, setQuoteIdx] = React.useState(0);
  React.useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIdx(idx => (idx + 1) % SAMURAI_QUOTES.length);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Remove useEffect for localStorage tags/notes

  useEffect(() => {
    const fetchStems = async () => {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from("stems")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        setError("Failed to fetch stems.");
        setLoading(false);
        return;
      }
      setStems(data || []);
      setLoading(false);
    };
    fetchStems();
  }, []);

  // Tag management (Supabase)
  // Remove addTag and removeTag functions and tagInputRefs usage

  // Description management (Supabase)
  // Remove editDescriptionId, descriptionDraft, startEditDescription, saveDescription, cancelEditDescription, and all related logic

  // Featured Scroll of the Day logic
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const stemsFromYesterday = stems.filter(stem => {
    if (!stem.created_at) return false;
    const created = new Date(stem.created_at);
    return created >= yesterday && created < today;
  });

  let featuredStem: StemVaultEntry | undefined;
  if (stemsFromYesterday.length > 0) {
    // Sort by play_count, then (optionally) download_count, then most recent
    featuredStem = [...stemsFromYesterday].sort((a, b) => {
      const playA = a.play_count || 0;
      const playB = b.play_count || 0;
      // If you have download_count, add similar logic here
      if (playB !== playA) return playB - playA;
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    })[0];
  } else {
    // Fallback: use the most recent stem
    featuredStem = stems.length > 0 ? [...stems].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] : undefined;
  }

  // --- Stats calculation ---
  useEffect(() => {
    if (onStatsUpdate) {
      const count = stems.length;
      const totalSize = stems.reduce((acc, s) => acc + (s.size_bytes || 0), 0);
      onStatsUpdate({ count, totalSize, uniqueUsers: 0 }); // uniqueUsers not available
    }
  }, [stems, onStatsUpdate]);

  // --- UI/UX helpers ---
  const isRecent = (created_at?: string | null) => {
    if (!created_at) {
      return false;
    }
    const now = Date.now();
    const then = new Date(created_at).getTime();
    return now - then < RECENT_UPLOAD_MINUTES * 60 * 1000;
  };
  const isFavorite = (id: string) => favorites.includes(id);
  const toggleFavorite = (id: string) =>
    setFavorites((favs) =>
      favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id]
    );
  // Remove addPlayCount and handleNoteChange functions

  // Add like handler
  const handleLike = async (id: string) => {
    const stem = stems.find((s) => s.id === id);
    if (!stem) {
      return;
    }
    const newLikeCount = (stem.like_count || 0) + 1;
    const { error } = await supabase
      .from("stems")
      .update({ like_count: newLikeCount })
      .eq("id", id);
    if (!error) {
      setStems((stems) =>
        stems.map((s) => (s.id === id ? { ...s, like_count: newLikeCount } : s))
      );
    }
  };

  // --- Audio controls ---
  const handlePlay = async (url: string, id: string) => {
    if (audio) {
      audio.pause();
      setAudio(null);
      setPlayingId(null);
    }
    const newAudio = new Audio(url);
    newAudio.onended = () => setPlayingId(null);
    newAudio.play();
    setAudio(newAudio);
    setPlayingId(id);
    // Increment play count
    const stem = stems.find((s) => s.id === id);
    if (!stem) {
      return;
    }
    const newPlayCount = (stem.play_count || 0) + 1;
    const { error } = await supabase
      .from("stems")
      .update({ play_count: newPlayCount })
      .eq("id", id);
    if (!error) {
      setStems((stems) =>
        stems.map((s) => (s.id === id ? { ...s, play_count: newPlayCount } : s))
      );
    }
  };
  const handlePause = () => {
    if (audio) {
      audio.pause();
      setAudio(null);
      setPlayingId(null);
    }
  };

  // --- Search/filter/sort ---
  const filtered = stems.filter(
    (stem) =>
      (!search ||
        stem.original_filename.toLowerCase().includes(search.toLowerCase()) ||
        stem.stem_name.toLowerCase().includes(search.toLowerCase())) &&
      (!filterType || stem.stem_type === filterType)
  );
  if (sortBy === "date") {
    filtered.sort((a, b) =>
      sortDir === "asc"
        ? new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime()
        : new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
    );
  }
  if (sortBy === "name") {
    filtered.sort((a, b) =>
      sortDir === "asc"
        ? a.stem_name.localeCompare(b.stem_name)
        : b.stem_name.localeCompare(a.stem_name)
    );
  }
  if (sortBy === "size") {
    filtered.sort((a, b) =>
      sortDir === "asc"
        ? (a.size_bytes || 0) - (b.size_bytes || 0)
        : (b.size_bytes || 0) - (a.size_bytes || 0)
    );
  }
  if (sortBy === "bpm") {
    filtered.sort((a, b) =>
      sortDir === "asc"
        ? (a.analysis?.bpm || 0) - (b.analysis?.bpm || 0)
        : (b.analysis?.bpm || 0) - (a.analysis?.bpm || 0)
    );
  }

  // --- Batch actions ---
  const toggleSelect = (id: string) =>
    setSelected((sel) =>
      sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id]
    );
  const selectAll = () => setSelected(filtered.map((s) => s.id));
  const clearSelected = () => setSelected([]);
  const handleBatchDownload = async () => {
    if (selected.length === 0) {
      return;
    }
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (const id of selected) {
      const stem = stems.find((s) => s.id === id);
      if (!stem) {
        continue;
      }
      const response = await fetch(stem.url);
      const blob = await response.blob();
      zip.file(stem.stem_name + ".wav", blob);
    }
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stems_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    clearSelected();
  };

  // Infinite scroll handler
  useEffect(() => {
    const handleScroll = () => {
      if (!gridRef.current) {
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = gridRef.current;
      if (scrollTop + clientHeight >= scrollHeight - 200) {
        // setVisibleCount((v) => Math.min(filtered.length, v + 16)); // Removed unused visibleCount
      }
    };
    const grid = gridRef.current;
    if (grid) {
      grid.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (grid) {
        grid.removeEventListener("scroll", handleScroll);
      }
    };
  }, [filtered.length]); // Removed filtered.length from dependency array

  // Group stems by original_filename
  const groupedStems = React.useMemo(() => groupBy(filtered, (s) => s.original_filename), [filtered]);
  const [playingGroup, setPlayingGroup] = useState<string | null>(null);
  const audioRefs = useRef<{ [id: string]: HTMLAudioElement | null }>({});

  const handlePlayGroup = (groupName: string) => {
    setPlayingGroup(groupName);
    const group = groupedStems[groupName] || [];
    // Pause all other audios
    Object.values(audioRefs.current).forEach(a => a && a.pause());
    // Reset and play all in group
    group.forEach(stem => {
      if (audioRefs.current[stem.id]) {
        audioRefs.current[stem.id]!.currentTime = 0;
        audioRefs.current[stem.id]!.play();
      }
    });
  };
  const handlePauseGroup = (groupName: string) => {
    setPlayingGroup(null);
    const group = groupedStems[groupName] || [];
    group.forEach(stem => {
      if (audioRefs.current[stem.id]) {
        audioRefs.current[stem.id]!.pause();
      }
    });
  };

  // --- UI ---
  return (
    <div className="min-h-screen font-inter text-neutral-100 bg-neutral-950 bg-daw-pattern bg-cover bg-center relative overflow-x-hidden">
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
      {/* Main Vault Content */}
      <div className="w-full max-w-[1600px] mx-auto px-8 py-12 rounded-2xl flex flex-col items-center font-inter">
        {/* Featured Scroll of the Day */}
        {featuredStem && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="mb-8 p-7 rounded-xl bg-neutral-900/90 flex flex-col gap-0 md:flex-row items-center relative overflow-hidden animate-pulse-slow"
          >
            <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
              <Play className="w-5 h-5 text-yellow-300 animate-bounce-x" />
              <span className="bg-yellow-400 text-black px-3 py-1 rounded-full font-bold text-xs tracking-wide shadow font-inter">
                Featured Scroll of the Day
              </span>
            </div>
            <div className="flex-1 flex flex-col items-start pl-0 md:pl-0 pt-10 gap-2 w-full">
              <span
                className="text-yellow-300 font-semibold text-lg truncate font-inter mt-2 mb-1"
                title={featuredStem.original_filename}
              >
                {featuredStem.original_filename.length > 32 && !showFullFeaturedName
                  ? `${featuredStem.original_filename.slice(0, 32)}... `
                  : featuredStem.original_filename}
                {featuredStem.original_filename.length > 32 && (
                  <button
                    className="ml-1 text-xs underline text-yellow-400 hover:text-yellow-300"
                    onClick={() => setShowFullFeaturedName((v) => !v)}
                    aria-label={showFullFeaturedName ? 'Collapse' : 'Expand'}
                  >
                    {showFullFeaturedName ? 'Less' : 'More'}
                  </button>
                )}
              </span>
              <button
                onClick={() => playingGroup === featuredStem.original_filename ? handlePauseGroup(featuredStem.original_filename) : handlePlayGroup(featuredStem.original_filename)}
                className="px-4 py-2 rounded bg-gradient-to-br from-red-600 to-yellow-500 text-black font-bold flex items-center gap-2 font-inter hover:brightness-110 transition mb-4"
              >
                {playingGroup === featuredStem.original_filename ? <PauseCircle className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {playingGroup === featuredStem.original_filename ? 'Pause All' : 'Play All'}
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
                {(groupedStems[featuredStem.original_filename] || []).map((stem: typeof stems[0]) => (
                  <motion.div
                    key={stem.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className={`bg-black/30 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 shadow-lg transition-transform relative font-inter`}
                  >
                    {/* Badges, Title, Info, etc. (reuse from below) */}
                    <div className="flex items-center gap-2 mb-1">
                      {stem.stem_type && (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 text-xs font-bold font-inter flex items-center gap-1" title={stem.stem_type}>
                          {stem.stem_type === 'vocals' && <Mic className="w-4 h-4" data-tooltip-id="stem-type-tooltip" data-tooltip-content="Vocals" />}
                          {stem.stem_type === 'drums' && <Drum className="w-4 h-4" data-tooltip-id="stem-type-tooltip" data-tooltip-content="Drums" />}
                          {stem.stem_type === 'bass' && <Music2 className="w-4 h-4" data-tooltip-id="stem-type-tooltip" data-tooltip-content="Bass" />}
                          {stem.stem_type === 'other' && <Shapes className="w-4 h-4" data-tooltip-id="stem-type-tooltip" data-tooltip-content="Other" />}
                        </span>
                      )}
                    </div>
                    <span className="text-yellow-200 text-base font-inter mb-1">
                      Stem: <b>{stem.stem_name}</b>
                    </span>
                    <span className="text-white/50 text-sm font-inter mb-1">
                      Size: {formatBytes(stem.size_bytes)}
                    </span>
                    <span className="text-white/40 text-xs font-inter mb-3">
                      Uploaded: {stem.created_at ? new Date(stem.created_at).toLocaleString() : "Unknown"}
                    </span>
                    <audio
                      ref={el => { audioRefs.current[stem.id] = el; }}
                      src={stem.url}
                      preload="auto"
                      onEnded={() => {
                        const group = groupedStems[featuredStem.original_filename] || [];
                        if (group.every((s) => audioRefs.current[s.id]?.ended)) {
                          setPlayingGroup(null);
                        }
                      }}
                    />
                    <a
                      href={stem.url}
                      download={stem.stem_name}
                      className="p-2 rounded-full bg-yellow-400 text-black font-bold text-xs font-inter flex items-center justify-center hover:bg-yellow-500 transition mt-2"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Download"
                      data-tooltip-id="stem-vault-tooltip"
                      data-tooltip-content="Download"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <div className="flex items-center bg-neutral-800 rounded-lg px-3 py-2 gap-2">
            <Search className="w-4 h-4 text-yellow-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stems..."
              className="bg-transparent outline-none text-white placeholder:text-white/40 w-40 font-inter"
            />
          </div>
          <div className="flex items-center bg-neutral-800 rounded-lg px-3 py-2 gap-2">
            <Filter className="w-4 h-4 text-yellow-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-white outline-none font-inter"
            >
              <option value="">All Types</option>
              {[...new Set(stems.map((s) => s.stem_type).filter(Boolean))].map(
                (type) => (
                  <option key={type as string} value={type as string}>
                    {type}
                  </option>
                )
              )}
            </select>
          </div>
          <div className="flex items-center bg-neutral-800 rounded-lg px-3 py-2 gap-2">
            <Filter className="w-4 h-4 text-yellow-400" />
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "date" | "name" | "size" | "bpm")
              }
              className="bg-transparent text-white outline-none font-inter"
            >
              <option value="date">Date</option>
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="bpm">BPM</option>
            </select>
            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="ml-1 text-yellow-400 font-inter"
              aria-label="Toggle sort direction"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={selectAll}
            className="px-3 py-1 rounded bg-yellow-400 text-black font-bold flex items-center gap-2 font-inter"
          >
            <CheckSquare className="w-4 h-4" />
            Select All
          </button>
          <button
            onClick={clearSelected}
            className="px-3 py-1 rounded bg-neutral-700 text-white font-bold flex items-center gap-2 font-inter"
          >
            <Square className="w-4 h-4" />
            Clear
          </button>
          <button
            onClick={handleBatchDownload}
            className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white font-bold flex items-center gap-2 font-inter"
            data-tooltip-id="stem-vault-tooltip"
            data-tooltip-content="Download Selected"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
        {/* Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {skeletons.map((_, i) => (
              <motion.div
                key={i}
                className="bg-neutral-900/80 border border-yellow-900 rounded-2xl p-6 flex flex-col gap-2 animate-pulse shadow-lg scale-100 hover:scale-105 transition-transform min-h-[220px]"
              >
                <div className="h-6 bg-yellow-900/30 rounded w-1/2 mb-2" />
                <div className="h-4 bg-white/10 rounded w-1/3 mb-1" />
                <div className="h-3 bg-white/10 rounded w-1/4 mb-1" />
                <div className="h-3 bg-white/10 rounded w-1/5 mb-1" />
                <div className="h-8 bg-white/10 rounded w-full mb-2" />
                <div className="flex gap-2 mt-2">
                  <div className="h-8 w-20 bg-yellow-900/30 rounded" />
                  <div className="h-8 w-20 bg-yellow-900/30 rounded" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
        {error && <div className="text-red-400 font-inter">{error}</div>}
        {!loading && filtered.length === 0 && (
          <div className="text-white/70 font-inter">No stems found.</div>
        )}
        <div className="w-full space-y-10">
          {Object.entries(groupedStems).map(([groupName, groupStems]: [string, typeof stems]) => (
            <div key={groupName} className="bg-black/20 rounded-2xl p-6 mb-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xl font-bold text-yellow-200 truncate" title={groupName}>{groupName}</span>
                <button
                  onClick={() => playingGroup === groupName ? handlePauseGroup(groupName) : handlePlayGroup(groupName)}
                  className="px-4 py-2 rounded bg-gradient-to-br from-red-600 to-yellow-500 text-black font-bold flex items-center gap-2 font-inter hover:brightness-110 transition"
                >
                  {playingGroup === groupName ? <PauseCircle className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  {playingGroup === groupName ? 'Pause All' : 'Play All'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {groupStems.map((stem: typeof stems[0]) => (
                  <motion.div
                    key={stem.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className={`bg-black/30 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 shadow-lg transition-transform relative font-inter ${selected.includes(stem.id) ? "ring-2 ring-yellow-400" : ""}`}
                  >
                    {/* Select checkbox */}
                    <button
                      onClick={() => toggleSelect(stem.id)}
                      className="absolute top-3 right-3 z-10"
                    >
                      {selected.includes(stem.id) ? (
                        <CheckSquare className="w-5 h-5 text-yellow-400" />
                      ) : (
                        <Square className="w-5 h-5 text-white/40" />
                      )}
                    </button>
                    {/* Badges */}
                    <div className="flex gap-2 mb-1">
                      {isRecent(stem.created_at) && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-bold font-inter">
                          <Sparkles
                            className="w-4 h-4 text-green-400"
                            data-tooltip-id="stem-vault-tooltip"
                            data-tooltip-content="New"
                          />
                        </span>
                      )}
                      {stem.stem_type && (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-400/20 text-yellow-400 text-xs font-bold font-inter flex items-center gap-1" title={stem.stem_type}>
                          {stem.stem_type === 'vocals' && <Mic className="w-4 h-4" data-tooltip-id="stem-type-tooltip" data-tooltip-content="Vocals" />}
                          {stem.stem_type === 'drums' && <Drum className="w-4 h-4" data-tooltip-id="stem-type-tooltip" data-tooltip-content="Drums" />}
                          {stem.stem_type === 'bass' && <Music2 className="w-4 h-4" data-tooltip-id="stem-type-tooltip" data-tooltip-content="Bass" />}
                          {stem.stem_type === 'other' && <Shapes className="w-4 h-4" data-tooltip-id="stem-type-tooltip" data-tooltip-content="Other" />}
                        </span>
                      )}
                      {stem.analysis?.bpm && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-400/20 text-blue-400 text-xs font-bold font-inter">
                          BPM: {stem.analysis.bpm}
                        </span>
                      )}
                      {isFavorite(stem.id) && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-400/20 text-pink-400 text-xs font-bold font-inter">
                          <Star
                            className="w-4 h-4 text-pink-400 fill-pink-400"
                            data-tooltip-id="stem-vault-tooltip"
                            data-tooltip-content="Favorite"
                          />
                        </span>
                      )}
                    </div>
                    {/* Title & Favorite */}
                    <div className="flex items-center gap-2">
                      <span
                        className="text-yellow-300 font-semibold text-lg flex-1 truncate font-inter"
                        title={stem.original_filename}
                      >
                        {stem.original_filename.length > 32 && !expandedNames[stem.id]
                          ? `${stem.original_filename.slice(0, 32)}... `
                          : stem.original_filename}
                        {stem.original_filename.length > 32 && (
                          <button
                            className="ml-1 text-xs underline text-yellow-400 hover:text-yellow-300"
                            onClick={() => setExpandedNames((prev) => ({ ...prev, [stem.id]: !prev[stem.id] }))}
                            aria-label={expandedNames[stem.id] ? 'Collapse' : 'Expand'}
                          >
                            {expandedNames[stem.id] ? 'Less' : 'More'}
                          </button>
                        )}
                      </span>
                      <button
                        onClick={() => toggleFavorite(stem.id)}
                        className="ml-2"
                        title={isFavorite(stem.id) ? "Unfavorite" : "Favorite"}
                      >
                        {isFavorite(stem.id) ? (
                          <Star className="w-6 h-6 text-pink-400 fill-pink-400" />
                        ) : (
                          <StarOff className="w-6 h-6 text-white/40" />
                        )}
                      </button>
                    </div>
                    <span className="text-yellow-200 text-sm font-inter">
                      Stem: <b>{stem.stem_name}</b>
                    </span>
                    <span className="text-white/50 text-xs font-inter">
                      Size: {formatBytes(stem.size_bytes)}
                    </span>
                    <span className="text-white/40 text-xs font-inter">
                      Uploaded:{" "}
                      {stem.created_at
                        ? new Date(stem.created_at).toLocaleString()
                        : "Unknown"}
                    </span>
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(stem.tags || []).map((tag: string) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full bg-yellow-700/30 text-yellow-200 text-xs flex items-center gap-1 font-inter"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {/* Description */}
                    <div className="mt-2">
                      <span className="text-white/70 text-xs font-inter">
                        {stem.description || (
                          <span className="italic text-white/30">No description</span>
                        )}
                      </span>
                    </div>
                    {/* Audio & AI Analysis */}
                    {stem.analysis && (
                      <div className="mt-2 p-2 rounded bg-neutral-900/60 border border-yellow-900 text-xs text-white/80 font-inter space-y-1">
                        <div className="font-bold text-yellow-300 mb-1">
                          Audio Analysis
                        </div>
                        {typeof stem.analysis.bpm !== "undefined" && (
                          <div>
                            <b>BPM:</b> {stem.analysis.bpm} (
                            {stem.analysis.bpm_confidence
                              ? `conf: ${stem.analysis.bpm_confidence}`
                              : ""}
                            )
                          </div>
                        )}
                        {stem.analysis.key && (
                          <div>
                            <b>Key:</b> {stem.analysis.key} (
                            {stem.analysis.key_confidence
                              ? `conf: ${stem.analysis.key_confidence}`
                              : ""}
                            )
                          </div>
                        )}
                        {typeof stem.analysis.duration !== "undefined" && (
                          <div>
                            <b>Duration:</b> {stem.analysis.duration} sec
                          </div>
                        )}
                        {typeof stem.analysis.spectral_centroid !== "undefined" && (
                          <div>
                            <b>Spectral Centroid:</b>{" "}
                            {stem.analysis.spectral_centroid}
                          </div>
                        )}
                        {typeof stem.analysis.spectral_rolloff !== "undefined" && (
                          <div>
                            <b>Spectral Rolloff:</b> {stem.analysis.spectral_rolloff}
                          </div>
                        )}
                        {typeof stem.analysis.spectral_bandwidth !== "undefined" && (
                          <div>
                            <b>Spectral Bandwidth:</b>{" "}
                            {stem.analysis.spectral_bandwidth}
                          </div>
                        )}
                        {typeof stem.analysis.zero_crossing_rate !== "undefined" && (
                          <div>
                            <b>Zero Crossing Rate:</b>{" "}
                            {stem.analysis.zero_crossing_rate}
                          </div>
                        )}
                        {typeof stem.analysis.dynamic_range !== "undefined" && (
                          <div>
                            <b>Dynamic Range:</b> {stem.analysis.dynamic_range}
                          </div>
                        )}
                        {typeof stem.analysis.sample_rate !== "undefined" && (
                          <div>
                            <b>Sample Rate:</b> {stem.analysis.sample_rate}
                          </div>
                        )}
                        {stem.analysis.mfcc_features && (
                          <div>
                            <b>MFCC Features:</b>{" "}
                            {stem.analysis.mfcc_features
                              .map((v: number) => v.toFixed(2))
                              .join(", ")}
                          </div>
                        )}
                        {stem.analysis.error && (
                          <div className="text-red-400">
                            <b>Error:</b> {stem.analysis.error}
                          </div>
                        )}
                        {/* Gemini AI Analysis */}
                        {getGeminiAnalysis(stem.analysis) && (
                          <div className="mt-2">
                            <div className="font-bold text-yellow-300 mb-1">
                              AI Audio Understanding
                            </div>
                            <div>
                              <b>Tags:</b>{" "}
                              {getGeminiAnalysis(stem.analysis)?.tags?.join(", ")}
                            </div>
                            <div>
                              <b>Description:</b>{" "}
                              {getGeminiAnalysis(stem.analysis)?.description}
                            </div>
                            <div>
                              <b>Transcription:</b>{" "}
                              {getGeminiAnalysis(stem.analysis)?.transcription}
                            </div>
                            <div>
                              <b>Genre Confidence:</b>{" "}
                              {getGeminiAnalysis(stem.analysis)?.genre_confidence}
                            </div>
                            <div>
                              <b>Has Vocals:</b>{" "}
                              {getGeminiAnalysis(stem.analysis)?.has_vocals
                                ? "Yes"
                                : "No"}
                            </div>
                            <div>
                              <b>Energy Level:</b>{" "}
                              {getGeminiAnalysis(stem.analysis)?.energy_level}
                            </div>
                            <div>
                              <b>Instruments Detected:</b>{" "}
                              {getGeminiAnalysis(
                                stem.analysis
                              )?.instruments_detected?.join(", ")}
                            </div>
                            {getGeminiAnalysis(stem.analysis)?.error && (
                              <div className="text-red-400">
                                <b>AI Error:</b>{" "}
                                {getGeminiAnalysis(stem.analysis)?.error}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Also show transcription if present on stem */}
                    {stem.transcription && (
                      <div className="mt-2 p-2 rounded bg-yellow-900/20 border border-yellow-700 text-xs text-yellow-200 font-inter">
                        <b>Transcription:</b> {stem.transcription}
                      </div>
                    )}
                    {/* Waveform Visualizer */}
                    <div className="mb-2">
                      <StemWaveform
                        stem={{ name: stem.stem_name, url: stem.url }}
                        volume={volumes[stem.id] ?? 1}
                        muted={false}
                        onMute={() => {}}
                        onVolume={(val) => handleVolumeChange(stem.id, val)}
                        waveContainerRef={(el) => {
                          waveformRefs.current[stem.id] = el;
                        }}
                        isPlaying={false}
                        loading={false}
                      />
                    </div>
                    {/* Play & Like Controls */}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <Play className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs text-white/70 font-inter">
                          {stem.play_count}
                        </span>
                      </div>
                      <button
                        onClick={() => handleLike(stem.id)}
                        className="flex items-center gap-1 text-pink-400 hover:text-pink-500 font-inter"
                      >
                        <Heart className="w-4 h-4" />
                        <span className="text-xs">{stem.like_count}</span>
                      </button>
                    </div>
                    {/* Waveform & Audio Controls */}
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={() =>
                          playingId === stem.id
                            ? handlePause()
                            : handlePlay(stem.url, stem.id)
                        }
                        aria-label={playingId === stem.id ? "Pause" : "Play"}
                        className={`p-3 rounded-full bg-gradient-to-br from-red-600 to-yellow-500 hover:brightness-110 transition shadow-lg flex items-center justify-center`}
                        data-tooltip-id="stem-vault-tooltip"
                        data-tooltip-content={
                          playingId === stem.id ? "Pause" : "Play"
                        }
                      >
                        {playingId === stem.id ? (
                          <PauseCircle className="w-6 h-6" strokeWidth={2.2} />
                        ) : (
                          <Play className="w-6 h-6" strokeWidth={2.2} />
                        )}
                      </button>
                      <a
                        href={stem.url}
                        download={stem.stem_name}
                        className="p-2 rounded-full bg-yellow-400 text-black font-bold text-xs ml-2 font-inter flex items-center justify-center hover:bg-yellow-500 transition"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Download"
                        data-tooltip-id="stem-vault-tooltip"
                        data-tooltip-content="Download"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    </div>
                    {/* Audio element for group sync */}
                    <audio
                      ref={el => { audioRefs.current[stem.id] = el; }}
                      src={stem.url}
                      preload="auto"
                      onEnded={() => {
                        // If all in group ended, clear playingGroup
                        const group = groupedStems[groupName] || [];
                        if (group.every((s: typeof stem) => audioRefs.current[s.id]?.ended)) {
                          setPlayingGroup(null);
                        }
                      }}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <footer className="w-full bg-neutral-900/95 border-t border-neutral-800 py-6 flex flex-col items-center justify-center shadow-daw-track mt-4 gap-3 animate-fade-in">
        <div className="flex items-center mb-2">
          <img src={samuraiLogo} alt="Samurai Logo" className="h-16 w-auto mr-3" style={{ display: 'inline-block' }} />
          <span className="text-yellow-400 font-russo text-lg tracking-wide">© 2025 Samurai. All rights reserved.</span>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full max-w-3xl justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400 animate-spin-slow" />
            <span className="text-yellow-200 text-sm font-russo">This app lets you split any song into vocals, drums, bass, and more—powered by AI and samurai spirit.</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-100 text-xs font-russo">Upload a track. We slice it into stems. Download, remix, and share!</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#" className="text-yellow-400 hover:underline text-xs font-russo">What are stems?</a>
            <a href="#" className="text-yellow-400 hover:underline text-xs font-russo">Remix ideas</a>
            <a href="#" className="text-yellow-400 hover:underline text-xs font-samuraijp">About Samurai Audio</a>
          </div>
        </div>
        <div className="mt-2 px-4 py-2 rounded border border-yellow-700 bg-neutral-800/80 flex items-center gap-3 max-w-xl text-center">
          <BookOpen className="w-5 h-5 text-yellow-400" />
          <span className="italic text-yellow-100 text-sm">“{SAMURAI_QUOTES[quoteIdx].text}”</span>
          <span className="text-yellow-400 text-xs ml-2">— {SAMURAI_QUOTES[quoteIdx].author}</span>
        </div>
      </footer>
      {/* FONTS & DAW BG */}
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue:wght@400&family=Noto+Serif+JP:wght@400;500&family=Russo+One&family=Sawarabi+Mincho&display=swap" rel="stylesheet" />
      <style>{`
        .font-bebas{font-family:'Bebas Neue',cursive;}
        .font-noto{font-family:'Noto Serif JP',serif;}
        .font-inter{font-family:'Inter',Arial,sans-serif;}
        .font-russo{font-family:'Russo One',sans-serif;}
        .font-samuraijp{font-family:'Sawarabi Mincho','Noto Serif JP',serif;}
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
        /* Animations */
        .animate-fade-in { animation: fadeIn 0.7s ease; }
        .animate-fade-in-slow { animation: fadeIn 1.5s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .animate-pulse-slow { animation: pulseSlow 2.5s infinite alternate; }
        @keyframes pulseSlow { 0% { box-shadow: 0 0 32px 4px #FFD70033; } 100% { box-shadow: 0 0 48px 8px #FFD70066; } }
      `}</style>
    </div>
  );
};

export default StemVault;
