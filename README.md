# Samurai

<!-- Project Logo -->
<p align="center">
  <img src="client/src/assets/logo/samurai-logo-v1-removebg.png" alt="Samurai Logo" width="180" />
</p>

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/your-org/samurai/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blue.svg)](CONTRIBUTING.md)

---

## 🎵 Samurai: AI-Powered Audio Stem Separation & Analysis

**Samurai** is a modern web application for musicians, producers, and audio engineers to upload tracks, separate stems (vocals, drums, bass, etc.), preview waveforms, and analyze audio using advanced AI models. Download individual stems or all at once, and get instant insights into your music.

---

## ✨ Features

- 🎤 **Upload audio** (MP3, WAV, etc.)
- ✂️ **AI-powered stem separation** (vocals, drums, bass, other)
- 🎚️ **Waveform preview** for original and stems
- 🤖 **AI audio analysis** (BPM, key, duration, sample rate, tags)
- 📥 **Download separated stems** (individually or as ZIP)
- 🏷️ **Tagging and metadata extraction**
- ⚡ **Fast, responsive UI** with drag-and-drop support
- 📊 **File size badges** for uploads and stems
- 🖥️ **Modern, mobile-friendly design**

---

## 📸 Screenshots

> _Add screenshots here_

| Upload & Analysis | Stems & Player |
|------------------|---------------|
| ![Upload Screenshot](docs/screenshots/upload.png) | ![Stems Screenshot](docs/screenshots/stems.png) |

---

## 🚀 Live Demo

> _Coming soon!_

Or run locally (see below).

---

## 🛠️ Technology Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Wavesurfer.js, Framer Motion
- **Backend:** Python, Flask, demucs, Essentia, Gemini AI (for analysis)
- **Other:** WebSockets, Docker (optional), modern CI/CD

---

## ⚡ Quickstart

### 1. Clone the repository
```bash
git clone https://github.com/your-org/samurai.git
cd samurai
```

### 2. Set up the Python backend
```bash
cd server
python3 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
python audio_api.py
```

### 3. Set up the React frontend
```bash
cd ../client
npm install
npm run dev
```

### 4. Open in your browser
Visit [http://localhost:5173](http://localhost:5173) (or as shown in your terminal)

---

## 📖 Usage

1. **Upload** an audio file via drag-and-drop or file picker.
2. **Preview** the waveform and audio features.
3. **Click 'Upload & Separate'** to process the file.
4. **View and play** separated stems in the Katana Player.
5. **Download** individual stems or all as a ZIP.
6. **Review AI analysis** and tags for your track.

---

## 📁 Folder Structure

```
samurai/
  client/      # React frontend
  server/      # Python Flask backend
  uploads/     # Uploaded audio files
  results/     # Separated stems output
  venv/        # Python virtual environment
  README.md    # This file
```

---

## 🤝 Contributing

- Fork the repo and create your branch from `main`.
- Follow code style and best practices (TypeScript, PEP8, etc.).
- Open issues for bugs/feature requests.
- Submit pull requests with clear descriptions.
- See [CONTRIBUTING.md](CONTRIBUTING.md) for more.

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙏 Credits & Acknowledgments

- [demucs](https://github.com/facebookresearch/demucs) for stem separation
- [Essentia](https://essentia.upf.edu/) for audio analysis
- [Wavesurfer.js](https://wavesurfer-js.org/) for waveform rendering
- [Google Gemini AI](https://ai.google.dev/) for advanced analysis
- All open source contributors and libraries

---

## 📬 Contact

- Project Lead: [Your Name](mailto:your.email@example.com)
- GitHub: [github.com/your-org/samurai](https://github.com/your-org/samurai)

---

> _Built with passion for music and technology._ 