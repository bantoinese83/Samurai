import type { ProgressData } from '../types';

export async function uploadAndTrackSeparation(file: File, onProgress: (data: ProgressData) => void, onError: (err: string) => void) {
  const API_URL = 'http://localhost:5001/separate';
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    const jobId = result.job_id;
    const eventSource = new EventSource(`http://localhost:5001/progress/${jobId}`);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onProgress(data);
      } catch (err) {
        onError('Error parsing SSE data');
      }
    };
    eventSource.onerror = () => {
      onError('Connection lost. Please try again.');
      eventSource.close();
    };
    return { jobId, eventSource };
  } catch (err: any) {
    onError(err.message || 'An error occurred.');
    return { jobId: null, eventSource: null };
  }
} 