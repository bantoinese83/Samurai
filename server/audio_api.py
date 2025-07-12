import os
import zipfile
import tempfile
from flask import Flask, request, send_file, jsonify, Response
from werkzeug.utils import secure_filename
from flask_cors import CORS
import sys
import uuid
from datetime import datetime
import threading
import time
import json
from audio_processing import separate_audio_with_progress
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env.local")

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
UPLOAD_FOLDER = 'uploads'
RESULTS_FOLDER = 'results'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

# Store job progress in memory (in production, use Redis or database)
job_progress = {}

@app.route('/')
def index():
    return jsonify({'message': 'StemSplitter API is running.'})

@app.route('/separate', methods=['POST'])
def separate():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    filename = secure_filename(file.filename)
    unique_id = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    base_name = os.path.splitext(filename)[0]
    parent_dir = os.path.join(RESULTS_FOLDER, base_name)
    input_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(input_path)

    # Initialize job progress
    job_id = unique_id
    job_progress[job_id] = {
        'status': 'processing',
        'progress': 0,
        'message': 'Starting audio separation...',
        'filename': base_name,
        'audio_features': None,
        'gemini_analysis': None
    }

    # Start processing in background thread
    def process_audio():
        output_dir = os.path.join(parent_dir, unique_id)
        os.makedirs(output_dir, exist_ok=True)
        try:
            # Update progress callback
            def progress_callback(progress, message, comprehensive_features=None):
                job_progress[job_id]['progress'] = progress
                job_progress[job_id]['message'] = message
                if comprehensive_features:
                    # Extract traditional audio features
                    traditional_features = {k: v for k, v in comprehensive_features.items() if k != 'gemini_analysis'}
                    job_progress[job_id]['audio_features'] = traditional_features
                    
                    # Extract Gemini analysis
                    if 'gemini_analysis' in comprehensive_features:
                        job_progress[job_id]['gemini_analysis'] = comprehensive_features['gemini_analysis']

            comprehensive_features = separate_audio_with_progress(input_path, output_dir, progress_callback)
            
            # Find demucs output directory
            demucs_subdirs = [d for d in os.listdir(output_dir) if os.path.isdir(os.path.join(output_dir, d))]
            if not demucs_subdirs:
                job_progress[job_id]['status'] = 'error'
                job_progress[job_id]['message'] = 'No stems found in output directory.'
                return

            stems_dir = os.path.join(output_dir, demucs_subdirs[0])
            
            # Demucs creates another subdirectory level, find the actual stems directory
            stems_subdirs = [d for d in os.listdir(stems_dir) if os.path.isdir(os.path.join(stems_dir, d))]
            if stems_subdirs:
                stems_dir = os.path.join(stems_dir, stems_subdirs[0])

            # Analyze individual stems
            job_progress[job_id]['progress'] = 92
            job_progress[job_id]['message'] = 'Analyzing individual stems...'
            
            from audio_analysis import analyze_audio_comprehensive
            stem_analyses = {}
            stem_files = [f for f in os.listdir(stems_dir) if f.endswith(('.wav', '.mp3'))]
            
            for i, stem_file in enumerate(stem_files):
                stem_path = os.path.join(stems_dir, stem_file)
                stem_name = os.path.splitext(stem_file)[0]
                try:
                    stem_comprehensive_analysis = analyze_audio_comprehensive(stem_path)
                    stem_analyses[stem_name] = stem_comprehensive_analysis
                    progress_percent = 92 + (i + 1) * 2 // len(stem_files)  # 92-94%
                    job_progress[job_id]['progress'] = progress_percent
                    job_progress[job_id]['message'] = f'Analyzing {stem_name} stem with AI...'
                except Exception as e:
                    print(f"Error analyzing stem {stem_name}: {e}")
                    stem_analyses[stem_name] = {'analysis_success': False, 'error': str(e)}

            # Update progress for zipping
            job_progress[job_id]['progress'] = 95
            job_progress[job_id]['message'] = 'Creating download package...'

            # Zip the results
            zip_path = os.path.join(tempfile.gettempdir(), f"{base_name}_stems_{unique_id}.zip")
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for root, _, files in os.walk(stems_dir):
                    for f in files:
                        zipf.write(os.path.join(root, f), arcname=f)

            # Complete
            job_progress[job_id]['status'] = 'completed'
            job_progress[job_id]['progress'] = 100
            job_progress[job_id]['message'] = 'Audio separation completed!'
            job_progress[job_id]['download_url'] = f'/download/{job_id}'
            job_progress[job_id]['zip_path'] = zip_path
            
            # Store comprehensive analysis results
            if comprehensive_features:
                traditional_features = {k: v for k, v in comprehensive_features.items() if k != 'gemini_analysis'}
                job_progress[job_id]['audio_features'] = traditional_features
                
                if 'gemini_analysis' in comprehensive_features:
                    job_progress[job_id]['gemini_analysis'] = comprehensive_features['gemini_analysis']
            
            job_progress[job_id]['stem_analyses'] = stem_analyses

        except Exception as e:
            job_progress[job_id]['status'] = 'error'
            job_progress[job_id]['message'] = f'Error: {str(e)}'

    # Start background processing
    thread = threading.Thread(target=process_audio)
    thread.start()

    return jsonify({'job_id': job_id})

@app.route('/progress/<job_id>')
def progress_stream(job_id):
    def generate():
        while True:
            if job_id in job_progress:
                data = json.dumps(job_progress[job_id])
                yield f"data: {data}\n\n"
                
                # Stop streaming when job is complete or failed
                if job_progress[job_id]['status'] in ['completed', 'error']:
                    break
            else:
                yield f"data: {json.dumps({'status': 'not_found', 'message': 'Job not found'})}\n\n"
                break
            
            time.sleep(0.5)  # Update every 500ms
    
    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    })

@app.route('/download/<job_id>')
def download_result(job_id):
    if job_id not in job_progress or job_progress[job_id]['status'] != 'completed':
        return jsonify({'error': 'Job not found or not completed'}), 404
    
    zip_path = job_progress[job_id]['zip_path']
    filename = job_progress[job_id]['filename']
    
    return send_file(zip_path, as_attachment=True, download_name=f"{filename}_stems.zip")

if __name__ == '__main__':
    port = 5001  # Changed to 5001 to match client configuration
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    app.run(host='0.0.0.0', port=port, debug=True) 