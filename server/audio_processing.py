import os
import subprocess
import re
import threading
from audio_analysis import analyze_audio_comprehensive

def separate_audio(input_path, output_dir):
    """
    Uses Demucs CLI to separate audio into stems.
    Requires Demucs to be installed and available in the environment.
    """
    os.makedirs(output_dir, exist_ok=True)
    # Call Demucs CLI
    try:
        subprocess.run([
            'demucs',
            '-o', output_dir,
            input_path
        ], check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Demucs separation failed: {e}")

def separate_audio_with_progress(input_path, output_dir, progress_callback):
    """
    Uses Demucs CLI to separate audio into stems with progress tracking.
    Also performs comprehensive audio analysis including Gemini AI understanding.
    Calls progress_callback(progress_percent, message, audio_features) during processing.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        # First, perform comprehensive audio analysis (traditional + Gemini AI)
        progress_callback(2, "Analyzing audio with AI understanding...", None)
        comprehensive_features = analyze_audio_comprehensive(input_path)
        progress_callback(8, "AI audio analysis complete", comprehensive_features)
        
        # Start demucs process
        process = subprocess.Popen([
            'demucs',
            '-o', output_dir,
            input_path
        ], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, 
           universal_newlines=True, bufsize=1)
        
        progress_callback(10, "Initializing audio separation...", comprehensive_features)
        
        # Track progress by parsing output
        current_progress = 10
        for line in process.stdout:
            line = line.strip()
            
            # Look for percentage patterns in demucs output
            percentage_match = re.search(r'(\d+)%', line)
            if percentage_match:
                percent = int(percentage_match.group(1))
                # Scale to 10-90% range (reserve 10% for init/analysis, 10% for post-processing)
                scaled_progress = 10 + (percent * 0.80)
                if scaled_progress > current_progress:
                    current_progress = scaled_progress
                    progress_callback(int(current_progress), f"Separating audio... {percent}%", comprehensive_features)
            
            # Look for other progress indicators
            elif "Separating track" in line:
                progress_callback(15, "Starting audio separation...", comprehensive_features)
            elif "Selected model" in line:
                progress_callback(12, "Loading AI model...", comprehensive_features)
            elif any(keyword in line.lower() for keyword in ["processing", "analyzing", "separating"]):
                if current_progress < 20:
                    current_progress = 20
                    progress_callback(20, "Processing audio data...", comprehensive_features)
        
        # Wait for process to complete
        return_code = process.wait()
        
        if return_code != 0:
            raise RuntimeError(f"Demucs separation failed with code {return_code}")
        
        progress_callback(90, "Finalizing separated stems...", comprehensive_features)
        
        return comprehensive_features
        
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Demucs separation failed: {e}")
    except Exception as e:
        raise RuntimeError(f"Audio separation error: {e}") 
    