// Shared types for audio separation and analysis

export interface Stem {
  name: string;
  url: string;
  tags?: string[];
  description?: string;
  transcription?: string;
}

export interface AudioFeatures {
  bpm?: number;
  bpm_confidence?: number;
  key?: string;
  key_confidence?: number;
  duration?: number;
  spectral_centroid?: number;
  spectral_rolloff?: number;
  spectral_bandwidth?: number;
  zero_crossing_rate?: number;
  dynamic_range?: number;
  mfcc_features?: number[];
  sample_rate?: number;
  analysis_success?: boolean;
  error?: string;
}

export interface GeminiAnalysis {
  success: boolean;
  tags: string[];
  description: string;
  transcription: string;
  genre_confidence: number;
  has_vocals: boolean;
  energy_level: number;
  instruments_detected: string[];
  error?: string;
}

export interface ProgressData {
  status: string;
  progress: number;
  message: string;
  filename?: string;
  audio_features?: AudioFeatures;
  stem_analyses?: { [stemName: string]: AudioFeatures };
  gemini_analysis?: GeminiAnalysis;
  download_url?: string;
  stems?: Stem[];
}

export interface StemVaultEntry {
  id: string;
  original_filename: string;
  stem_name: string;
  stem_type?: string | null;
  url: string;
  size_bytes?: number | null;
  created_at?: string | null;
  analysis?: AudioFeatures | null;
  tags?: string[];
  description?: string;
  transcription?: string;
  play_count: number;
  like_count: number;
} 