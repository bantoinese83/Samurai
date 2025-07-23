import type { ProgressData } from '../types';
import { supabase } from '../supabaseClient';
import type { Stem } from '../types';

export async function uploadAndTrackSeparation(file: File, onProgress: (data: ProgressData) => void, onError: (err: string) => void) {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_URL}/separate`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    const jobId = result.job_id;
    const eventSource = new EventSource(`${API_URL}/progress/${jobId}`);
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
    return { jobId, eventSource };
  } catch (err: unknown) {
    const hasMessage = (e: unknown): e is { message: string } =>
      typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string';
    if (hasMessage(err)) {
      onError(err.message);
    } else {
      onError('An error occurred.');
    }
    return { jobId: null, eventSource: null };
  }
}

export async function uploadStemToVault(
  stem: Stem,
  originalFilename: string,
  analysis?: any,
  tags?: string[],
  description?: string,
  transcription?: string
) {
  // Upload to Supabase Storage
  let fileBlob;
  try {
    fileBlob = await fetch(stem.url).then(r => r.blob());
  } catch (e) {
    const errMsg = (typeof e === 'object' && e !== null && 'message' in e) ? (e as any).message : String(e);
    console.error('Failed to fetch stem blob:', errMsg);
    throw new Error('Failed to fetch stem blob: ' + errMsg);
  }
  const path = `${Date.now()}_${stem.name}`;
  // Upload to bucket
  const { error: storageError } = await supabase.storage.from('stem-vault').upload(path, fileBlob, { upsert: false });
  if (storageError) {
    console.error('Supabase storage upload error:', storageError);
    throw new Error('Failed to upload to storage: ' + storageError.message + ' (Check if bucket "stem-vault" exists and is public)');
  }
  // Get public URL
  const { data: publicUrlData } = supabase.storage.from('stem-vault').getPublicUrl(path);
  const publicUrl = publicUrlData?.publicUrl;
  if (!publicUrl) {
    console.error('No public URL returned for path:', path, publicUrlData);
    throw new Error('No public URL returned for uploaded file. Check bucket permissions.');
  }
  // Insert metadata into stems table
  const { data: insertData, error: dbError } = await supabase.from('stems').insert({
    original_filename: originalFilename,
    stem_name: stem.name,
    stem_type: stem.name.replace(/\.(wav|mp3)$/i, ''),
    url: publicUrl,
    size_bytes: fileBlob.size,
    analysis: analysis || null,
    tags: tags || null,
    description: description || null,
    transcription: transcription || null,
  }).select('id');
  if (dbError) {
    console.error('Supabase DB insert error:', dbError);
    throw new Error('Failed to insert metadata: ' + dbError.message);
  }
  return insertData;
} 