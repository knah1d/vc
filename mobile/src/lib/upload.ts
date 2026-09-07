import { File } from 'expo-file-system';

import { api } from './api';

// Uploads a local file (from the image/document picker) directly to R2 via a
// short-lived presigned PUT URL — the file bytes never pass through our own
// backend, only the tiny presign request does.
export async function uploadAttachment(localUri: string, filename: string, contentType: string): Promise<string> {
  const { uploadUrl, publicUrl } = await api.presignUpload(filename, contentType);
  const file = new File(localUri);
  const result = await file.upload(uploadUrl, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': contentType },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed (status ${result.status}).`);
  }
  return publicUrl;
}
