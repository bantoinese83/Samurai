# StemSplitter Audio Separation Server

This is a Flask-based API for separating audio files into stems using Demucs, enhanced with **Gemini AI** for intelligent audio understanding and tag generation.

## Features
- **Advanced Audio Separation**: Utilizes the state-of-the-art Demucs model for accurate and efficient audio track separation.
- **🧠 AI-Powered Audio Understanding**: Uses Google's Gemini AI (via the new [Google GenAI SDK](https://pypi.org/project/google-genai/)) to analyze audio content and generate:
  - Descriptive tags (genre, mood, instruments, production style)
  - Audio content descriptions
  - Vocal transcription (when applicable)
  - Energy level analysis
  - Instrument detection
  - Genre confidence scoring
- **Traditional Audio Analysis**: BPM detection, key detection, and spectral analysis using librosa
- **Secure API**: The server offers a secure API endpoint for uploading audio files and receiving the processed output.
- **Real-time Progress**: Server-Sent Events (SSE) for live progress updates during processing
- **Docker Integration**: Containerized with Docker for easy setup, deployment, and scalability.
- **Customizable**: Easy to modify and extend based on individual project requirements.

## Prerequisites
- Docker (optional, for containerized deployment)
- Python 3.8+
- pip (Python package manager)
- Demucs (install via pip or conda, or use Docker)
- **Gemini API Key** (for AI audio understanding features)
- **google-genai** (new SDK, replaces google-generativeai)

## Installation

### 1. Clone the Repository:
```bash
git clone https://github.com/jinoAlgon/StemSplitter-Audio-Separation-Server.git
cd StemSplitter
```

### 2. Set up Gemini AI Integration (Recommended)
```bash
cd server
python setup_gemini.py
```

This interactive script will:
- Help you obtain a Gemini API key
- Test your API key
- Configure environment variables
- Verify dependencies

**Manual Setup:**
1. Get a Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Set the environment variable:
   ```bash
   export GEMINI_API_KEY="your_api_key_here"
   ```
   Or create a `.env` file in the server directory:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

### 3. Build and Run the Docker Container
```bash
docker build -t audio-server ./server
docker run -p 5000:5000 -e GEMINI_API_KEY="your_api_key_here" audio-server
```
The server will start running on localhost at port 5000.

### 4. Or Run Locally
```bash
cd server
pip install -r requirements.txt
python audio_api.py
```

## Usage
To separate an audio file into stems with AI analysis:
- Send a POST request to http://localhost:5000/separate with the audio file.
- Monitor progress via Server-Sent Events at http://localhost:5000/progress/{job_id}
- Receive the processed file as a zip containing the separated tracks.
- Get AI-generated tags and analysis in the response.

Example using curl:
```bash
curl -X POST -F "file=@path_to_your_audio_file.mp3" http://localhost:5000/separate
```

## Gemini AI Integration Example (Python)

**With the new Google GenAI SDK:**
```python
from google import genai

client = genai.Client()  # Uses GEMINI_API_KEY from env
myfile = client.files.upload(file="path/to/audio.mp3")
response = client.models.generate_content(
    model="gemini-2.0-flash",
    contents=["Describe this audio clip", myfile]
)
print(response.text)
```

## API Response Format
The API now returns enhanced analysis data:

```json
{
  "job_id": "unique_job_id",
  "status": "completed",
  "progress": 100,
  "message": "Audio separation completed!",
  "audio_features": {
    "bpm": 120.5,
    "key": "C major",
    "key_confidence": 0.85,
    "duration": 180.2,
    "sample_rate": 44100,
    "analysis_success": true
  },
  "gemini_analysis": {
    "success": true,
    "tags": ["hip-hop", "energetic", "bass-heavy", "male-vocals", "modern"],
    "description": "An energetic hip-hop track with prominent bass and male vocals",
    "transcription": "Started from the bottom now we're here...",
    "genre_confidence": 0.92,
    "has_vocals": true,
    "energy_level": 8,
    "instruments_detected": ["drums", "bass", "synthesizer", "vocals"]
  },
  "stem_analyses": {
    "drums": { /* traditional + gemini analysis */ },
    "bass": { /* traditional + gemini analysis */ },
    "vocals": { /* traditional + gemini analysis */ },
    "other": { /* traditional + gemini analysis */ }
  }
}
```

## Features Breakdown

### Traditional Audio Analysis
- **BPM Detection**: Accurate tempo detection using librosa
- **Key Detection**: Musical key identification with confidence scoring
- **Spectral Analysis**: Frequency domain characteristics
- **Duration & Sample Rate**: Basic audio properties

### AI Audio Understanding (Gemini)
- **Smart Tagging**: Genre, mood, instrument, and production style tags
- **Content Description**: Natural language description of the audio
- **Vocal Transcription**: Automatic speech-to-text for vocal content
- **Energy Analysis**: 1-10 scale energy/intensity rating
- **Instrument Detection**: AI-powered instrument identification
- **Genre Confidence**: Confidence scoring for genre classification

## Notes
- The backend uses the real Demucs CLI for separation. Make sure Demucs is installed and available in your environment.
- If you use Docker, Demucs will be installed in the container.
- **Gemini AI features are optional** - the server will work without an API key but won't provide AI insights.
- Error handling is improved: if separation fails, you will receive a JSON error message.
- AI analysis adds approximately 10-30 seconds to processing time depending on audio length.

## Troubleshooting

### Gemini API Issues
- Ensure your API key is valid and has sufficient quota
- Check that the `GEMINI_API_KEY` environment variable is set correctly
- Run `python setup_gemini.py` to test your configuration

### Audio Processing Issues
- Verify that Demucs is properly installed
- Check that input audio files are in supported formats (MP3, WAV, FLAC, etc.)
- Ensure sufficient disk space for temporary files

## Contributing
Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## License
This project is licensed under the MIT License - see the LICENSE file for details. 