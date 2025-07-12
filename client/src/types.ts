// Shared types for audio separation and analysis

export interface Stem {
  name: string;
  url: string;
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
  stem_analyses?: { [stemName: string]: any };
  gemini_analysis?: GeminiAnalysis;
  download_url?: string;
  stems?: Stem[];
} 