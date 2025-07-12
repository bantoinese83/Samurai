import numpy as np
import librosa
import soundfile as sf
import json
from typing import List, Dict, Any
import os
import re
import essentia.standard as es
from scipy import signal
from scipy.stats import mode
import warnings
warnings.filterwarnings('ignore')

# Try to import google.genai - if not available, disable AI features
try:
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    print("Google GenAI not available - AI audio analysis features will be disabled")

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY or not GENAI_AVAILABLE:
    print("Warning: GEMINI_API_KEY not set or Google GenAI not available, audio understanding features will be disabled")

def analyze_audio_with_gemini(audio_path: str) -> Dict[str, Any]:
    """
    Use Gemini API to analyze audio content and generate descriptive tags.
    Returns a dictionary with generated tags, transcription, and audio description.
    """
    # Check if GenAI is available and API key is set
    if not GENAI_AVAILABLE or not GEMINI_API_KEY:
        return {
            'success': False,
            'error': 'Google GenAI not available or API key not set',
            'tags': [],
            'description': '',
            'transcription': '',
            'genre_confidence': 0.0,
            'has_vocals': False,
            'energy_level': 0,
            'instruments_detected': []
        }
    
    # The new SDK will pick up your API key from GEMINI_API_KEY or GOOGLE_API_KEY env vars
    client = genai.Client()
    try:
        myfile = client.files.upload(file=audio_path)
        prompt = '''
        You are an expert audio analyst. Analyze the provided audio file and return a JSON object with the following fields ONLY (omit any fields not applicable):

        - "tags": Array of 8-12 descriptive tags about the audio (genre, mood, instruments, vocals, production style, tempo, musical elements). Tags should be lowercase, single words or short phrases, and relevant to the audio.
        - "description": 2-3 sentence summary of the audio's content, style, and mood.
        - "transcription": If vocals/lyrics are present, provide a brief transcription (max 50 words), otherwise use an empty string.
        - "genre_confidence": Float between 0 and 1 for confidence in the primary genre.
        - "has_vocals": Boolean, true if vocals are present, false otherwise.
        - "energy_level": Integer 1-10 rating the track's energy/intensity.
        - "instruments_detected": Array of instruments identified in the audio.

        Constraints:
        - Respond ONLY with a valid, minified JSON object (no markdown, no explanations, no code block formatting, no extra text).
        - Omit any fields that cannot be confidently determined.
        - Do not include any field not listed above.
        - If you are unsure about a value, use a reasonable default (e.g., empty string, false, 0.5, or empty array).

        Example 1:
        {
          "tags": ["hip-hop", "energetic", "male-vocals", "rap", "polished", "mid-tempo", "bass-heavy", "rhythmic", "samples", "synthesizer", "drums"],
          "description": "This is an energetic hip-hop track featuring male rap vocals. It has a polished production style, a mid-tempo beat, and a bass-heavy, rhythmic arrangement with prominent use of samples and synthesizers.",
          "transcription": "It's a cultural divide, I'm gonna get it on the floor. 40 acres and a mule, this is bigger than the music.",
          "genre_confidence": 0.9,
          "has_vocals": true,
          "energy_level": 8,
          "instruments_detected": ["synthesizer", "drums", "sampler"]
        }
        Example 2:
        {
          "tags": ["lo-fi", "ambient", "chill", "instrumental", "downtempo", "melodic", "atmospheric", "synthesizer", "slow-tempo", "calm", "relaxing"],
          "description": "This is a chill, lo-fi instrumental piece. It features a relaxed tempo, a soothing melody, and an overall calming atmosphere, perfect for relaxing or studying.",
          "transcription": "",
          "genre_confidence": 0.85,
          "has_vocals": false,
          "energy_level": 3,
          "instruments_detected": ["synthesizer", "drums"]
        }
        '''
        
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt, myfile]
        )
        try:
            # Remove triple backticks and optional 'json' label
            cleaned_text = re.sub(r'^```(?:json)?\s*|```$', '', response.text.strip(), flags=re.IGNORECASE | re.MULTILINE)
            gemini_analysis = json.loads(cleaned_text)
            cleaned_analysis = {
                'success': True,
                'tags': gemini_analysis.get('tags', [])[:12],
                'description': gemini_analysis.get('description', ''),
                'transcription': gemini_analysis.get('transcription', ''),
                'genre_confidence': float(gemini_analysis.get('genre_confidence', 0.5)),
                'has_vocals': bool(gemini_analysis.get('has_vocals', False)),
                'energy_level': int(gemini_analysis.get('energy_level', 5)),
                'instruments_detected': gemini_analysis.get('instruments_detected', [])
            }
            return cleaned_analysis
        except json.JSONDecodeError as e:
            print(f"JSON parsing failed, raw response: {response.text}")
            return {
                'success': False,
                'error': f'JSON parsing failed: {str(e)}',
                'tags': [],
                'description': 'Audio analysis failed',
                'transcription': '',
                'genre_confidence': 0.5,
                'has_vocals': False,
                'energy_level': 5,
                'instruments_detected': []
            }
    except Exception as e:
        print(f"Gemini audio analysis error: {e}")
        return {
            'success': False,
            'error': str(e),
            'tags': [],
            'description': '',
            'transcription': '',
            'genre_confidence': 0.0,
            'has_vocals': False,
            'energy_level': 0,
            'instruments_detected': []
        }

def advanced_bpm_detection(y, sr):
    """
    Advanced BPM detection using multiple methods and ensemble techniques.
    Returns BPM with high accuracy and confidence score.
    """
    try:
        # Method 1: Librosa beat tracking with different hop lengths
        tempo_estimates = []
        confidence_scores = []
        
        # Multiple hop lengths for better accuracy
        hop_lengths = [512, 1024, 2048]
        for hop_length in hop_lengths:
            try:
                tempo, beats = librosa.beat.beat_track(y=y, sr=sr, hop_length=hop_length)
                if tempo > 0:
                    tempo_estimates.append(float(tempo))
                    confidence_scores.append(0.7)  # Base confidence for librosa
            except:
                continue
        
        # Method 2: Onset-based tempo detection
        try:
            onset_frames = librosa.onset.onset_detect(y=y, sr=sr, units='time')
            if len(onset_frames) > 3:
                onset_intervals = np.diff(onset_frames)
                if len(onset_intervals) > 0:
                    # Convert intervals to BPM
                    onset_bpm = 60.0 / np.median(onset_intervals)
                    if 40 <= onset_bpm <= 200:  # Reasonable tempo range
                        tempo_estimates.append(onset_bpm)
                        confidence_scores.append(0.6)
        except:
            pass
        
        # Method 3: Essentia BPM detection (if available)
        try:
            # Convert to essentia format
            audio_essentia = es.MonoLoader(filename="temp")()
            bpm_extractor = es.BpmHistogramDescriptors()
            bpm_histogram = es.BpmHistogram()(audio_essentia)
            bpm_desc = bpm_extractor(bpm_histogram)
            
            if bpm_desc[0] > 0:  # First output is BPM
                tempo_estimates.append(float(bpm_desc[0]))
                confidence_scores.append(0.8)  # Higher confidence for essentia
        except:
            pass
        
        # Method 4: Autocorrelation-based tempo detection
        try:
            # Use onset strength for autocorrelation
            onset_strength = librosa.onset.onset_strength(y=y, sr=sr)
            # Autocorrelation
            autocorr = librosa.autocorrelate(onset_strength)
            # Find peaks in autocorrelation
            peaks = librosa.util.peak_pick(autocorr, pre_max=3, post_max=3, 
                                         pre_avg=3, post_avg=5, delta=0.1, wait=10)
            
            if len(peaks) > 0:
                # Convert lag to BPM
                best_peak = peaks[0]
                if best_peak > 0:
                    bpm_autocorr = 60.0 * sr / (best_peak * 512)  # 512 is hop length
                    if 40 <= bpm_autocorr <= 200:
                        tempo_estimates.append(bpm_autocorr)
                        confidence_scores.append(0.65)
        except:
            pass
        
        # Method 5: Dynamic tempo tracking
        try:
            # Use dynamic programming-based tempo tracking
            onset_strength = librosa.onset.onset_strength(y=y, sr=sr)
            prior = librosa.beat.tempo_frequencies(240, hop_length=512, sr=sr)
            utempo = librosa.beat.tempo(onset_envelope=onset_strength, sr=sr, 
                                      hop_length=512, prior=prior)
            if utempo[0] > 0:
                tempo_estimates.append(float(utempo[0]))
                confidence_scores.append(0.75)
        except:
            pass
        
        if not tempo_estimates:
            return None, 0.0
        
        # Ensemble method: weighted average with outlier removal
        tempo_estimates = np.array(tempo_estimates)
        confidence_scores = np.array(confidence_scores)
        
        # Remove outliers (more than 2 standard deviations from median)
        if len(tempo_estimates) > 2:
            median_tempo = np.median(tempo_estimates)
            std_tempo = np.std(tempo_estimates)
            
            valid_mask = np.abs(tempo_estimates - median_tempo) <= 2 * std_tempo
            tempo_estimates = tempo_estimates[valid_mask]
            confidence_scores = confidence_scores[valid_mask]
        
        if len(tempo_estimates) == 0:
            return None, 0.0
        
        # Weighted average
        final_bpm = np.average(tempo_estimates, weights=confidence_scores)
        final_confidence = np.mean(confidence_scores)
        
        # Handle common tempo doubling/halving errors
        if final_bpm > 160:
            # Check if half tempo makes more sense
            half_tempo = final_bpm / 2
            if 80 <= half_tempo <= 140:
                final_bpm = half_tempo
        elif final_bpm < 80:
            # Check if double tempo makes more sense
            double_tempo = final_bpm * 2
            if 120 <= double_tempo <= 160:
                final_bpm = double_tempo
        
        return round(final_bpm, 1), round(final_confidence, 2)
        
    except Exception as e:
        print(f"Advanced BPM detection error: {e}")
        return None, 0.0

def advanced_key_detection(y, sr):
    """
    Advanced key detection using HPCP (Harmonic Pitch Class Profiles) and 
    multiple algorithms for high accuracy.
    """
    try:
        # Method 1: Enhanced Chroma-based key detection
        chroma_methods = []
        
        # Use different chroma variants
        chroma_stft = librosa.feature.chroma_stft(y=y, sr=sr)
        chroma_cqt = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_cens = librosa.feature.chroma_cens(y=y, sr=sr)
        
        chromagrams = [chroma_stft, chroma_cqt, chroma_cens]
        weights = [0.4, 0.4, 0.2]  # CQT generally better for key detection
        
        # Krumhansl-Schmuckler key profiles (more accurate than simple major/minor)
        major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
        minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
        
        # Normalize profiles
        major_profile = major_profile / np.sum(major_profile)
        minor_profile = minor_profile / np.sum(minor_profile)
        
        pitch_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        
        key_scores = []
        
        for chroma, weight in zip(chromagrams, weights):
            # Calculate mean chroma vector
            chroma_mean = np.mean(chroma, axis=1)
            chroma_mean = chroma_mean / np.sum(chroma_mean)  # Normalize
            
            # Calculate correlation with each key
            for i in range(12):  # 12 pitch classes
                # Major key
                major_shifted = np.roll(major_profile, i)
                major_corr = np.corrcoef(chroma_mean, major_shifted)[0, 1]
                if not np.isnan(major_corr):
                    key_scores.append((f"{pitch_names[i]} major", major_corr * weight))
                
                # Minor key
                minor_shifted = np.roll(minor_profile, i)
                minor_corr = np.corrcoef(chroma_mean, minor_shifted)[0, 1]
                if not np.isnan(minor_corr):
                    key_scores.append((f"{pitch_names[i]} minor", minor_corr * weight))
        
        # Method 2: Essentia key detection (if available)
        try:
            # This requires essentia with proper installation
            key_extractor = es.KeyExtractor()
            key, scale, strength = key_extractor(y.astype(np.float32))
            
            if strength > 0.1:  # Minimum confidence threshold
                essentia_key = f"{key} {scale}"
                key_scores.append((essentia_key, strength * 0.8))  # High weight for essentia
        except:
            pass
        
        # Method 3: Harmonic analysis-based key detection
        try:
            # Extract harmonic content
            harmonic, percussive = librosa.effects.hpss(y)
            
            # Use harmonic component for key detection
            chroma_harmonic = librosa.feature.chroma_cqt(y=harmonic, sr=sr)
            chroma_harmonic_mean = np.mean(chroma_harmonic, axis=1)
            chroma_harmonic_mean = chroma_harmonic_mean / np.sum(chroma_harmonic_mean)
            
            for i in range(12):
                # Test against key profiles
                major_shifted = np.roll(major_profile, i)
                minor_shifted = np.roll(minor_profile, i)
                
                major_corr = np.corrcoef(chroma_harmonic_mean, major_shifted)[0, 1]
                minor_corr = np.corrcoef(chroma_harmonic_mean, minor_shifted)[0, 1]
                
                if not np.isnan(major_corr):
                    key_scores.append((f"{pitch_names[i]} major", major_corr * 0.6))
                if not np.isnan(minor_corr):
                    key_scores.append((f"{pitch_names[i]} minor", minor_corr * 0.6))
        except:
            pass
        
        if not key_scores:
            return "Unknown", 0.0
        
        # Aggregate scores for same keys
        key_aggregated = {}
        for key, score in key_scores:
            if key in key_aggregated:
                key_aggregated[key] += score
            else:
                key_aggregated[key] = score
        
        # Find the key with highest aggregate score
        best_key = max(key_aggregated, key=key_aggregated.get)
        best_score = key_aggregated[best_key]
        
        # Normalize confidence score
        confidence = min(1.0, max(0.0, best_score))
        
        return best_key, round(confidence, 2)
        
    except Exception as e:
        print(f"Advanced key detection error: {e}")
        return "Unknown", 0.0

def analyze_audio_features(audio_path):
    """
    Enhanced audio analysis with advanced BPM and key detection algorithms.
    Uses multiple methods and ensemble techniques for high accuracy.
    """
    try:
        # Load audio with librosa
        y, sr = librosa.load(audio_path, sr=None)
        
        # Advanced BPM Detection
        bpm, bpm_confidence = advanced_bpm_detection(y, sr)
        
        # Advanced Key Detection
        key_signature, key_confidence = advanced_key_detection(y, sr)
        
        # Additional audio characteristics
        duration = float(librosa.get_duration(y=y, sr=sr))
        
        # Enhanced spectral features
        spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        zero_crossing_rate = float(np.mean(librosa.feature.zero_crossing_rate(y)))
        
        # Additional features for better analysis
        spectral_rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
        spectral_bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr)))
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfccs, axis=1)
        
        # Dynamic range analysis
        rms = librosa.feature.rms(y=y)[0]
        dynamic_range = float(np.max(rms) - np.min(rms))
        
        return {
            'bpm': bpm,
            'bpm_confidence': bpm_confidence if bpm else 0.0,
            'key': key_signature,
            'key_confidence': key_confidence,
            'duration': round(duration, 2),
            'spectral_centroid': round(spectral_centroid, 1),
            'spectral_rolloff': round(spectral_rolloff, 1),
            'spectral_bandwidth': round(spectral_bandwidth, 1),
            'zero_crossing_rate': round(zero_crossing_rate, 4),
            'dynamic_range': round(dynamic_range, 4),
            'mfcc_features': mfcc_mean.tolist(),
            'sample_rate': int(sr),
            'analysis_success': True
        }
        
    except Exception as e:
        print(f"Audio analysis error: {e}")
        return {
            'bpm': None,
            'bpm_confidence': 0.0,
            'key': 'Unknown',
            'key_confidence': 0.0,
            'duration': None,
            'spectral_centroid': None,
            'spectral_rolloff': None,
            'spectral_bandwidth': None,
            'zero_crossing_rate': None,
            'dynamic_range': None,
            'mfcc_features': None,
            'sample_rate': None,
            'analysis_success': False,
            'error': str(e)
        }

def analyze_audio_comprehensive(audio_path: str) -> Dict[str, Any]:
    """
    Comprehensive audio analysis combining traditional audio features with Gemini AI understanding.
    Returns both technical audio features and AI-generated insights.
    """
    # Get traditional audio features
    traditional_features = analyze_audio_features(audio_path)
    
    # Get Gemini AI analysis
    gemini_analysis = analyze_audio_with_gemini(audio_path)
    
    # Combine results
    comprehensive_analysis = {
        **traditional_features,
        'gemini_analysis': gemini_analysis
    }
    
    return comprehensive_analysis

def get_key_color(key_signature):
    """
    Return a color associated with the detected key for UI theming.
    """
    key_colors = {
        'C major': '#FF6B6B',      # Red
        'C minor': '#FF8E8E',      # Light Red
        'C# major': '#FF9F43',     # Orange
        'C# minor': '#FFB366',     # Light Orange
        'D major': '#FFA726',      # Deep Orange
        'D minor': '#FFCC80',      # Light Orange
        'D# major': '#FFEB3B',     # Yellow
        'D# minor': '#FFF176',     # Light Yellow
        'E major': '#8BC34A',      # Light Green
        'E minor': '#AED581',      # Lighter Green
        'F major': '#4CAF50',      # Green
        'F minor': '#81C784',      # Light Green
        'F# major': '#26A69A',     # Teal
        'F# minor': '#4DB6AC',     # Light Teal
        'G major': '#29B6F6',      # Light Blue
        'G minor': '#64B5F6',      # Lighter Blue
        'G# major': '#3F51B5',     # Indigo
        'G# minor': '#7986CB',     # Light Indigo
        'A major': '#9C27B0',      # Purple
        'A minor': '#BA68C8',      # Light Purple
        'A# major': '#E91E63',     # Pink
        'A# minor': '#F06292',     # Light Pink
        'B major': '#F44336',      # Red
        'B minor': '#EF5350',      # Light Red
    }
    
    return key_colors.get(key_signature, '#9E9E9E')  # Default gray

def format_bpm_description(bpm):
    """
    Return a musical description of the BPM range.
    """
    if bpm is None:
        return "Unknown tempo"
    elif bpm < 60:
        return f"{bpm} BPM (Very Slow)"
    elif bpm < 80:
        return f"{bpm} BPM (Slow)"
    elif bpm < 100:
        return f"{bpm} BPM (Moderate)"
    elif bpm < 120:
        return f"{bpm} BPM (Medium)"
    elif bpm < 140:
        return f"{bpm} BPM (Fast)"
    elif bpm < 160:
        return f"{bpm} BPM (Very Fast)"
    else:
        return f"{bpm} BPM (Extremely Fast)" 