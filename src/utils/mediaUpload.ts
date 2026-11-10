import { ref, uploadBytesResumable, getDownloadURL, UploadTask } from 'firebase/storage';
import { storage } from '../firebase';
import { FileAttachment } from '../types';
import { getFileExtension } from './validation';

/**
 * Returns the best supported audio MIME type and file extension for MediaRecorder,
 * including Safari iOS/macOS fallback (audio/mp4 or audio/aac).
 */
export function getSupportedAudioMimeType(): { mimeType: string; extension: string } {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { mimeType: 'audio/webm', extension: 'webm' };
  }

  const candidates: Array<{ mimeType: string; extension: string }> = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/mp4', extension: 'm4a' },
    { mimeType: 'audio/aac', extension: 'aac' },
    { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
  ];

  for (const candidate of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
        return candidate;
      }
    } catch {
      // Ignore unsupported checks on older browsers
    }
  }

  return { mimeType: '', extension: 'webm' };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to encode file data.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file data.'));
    reader.readAsDataURL(blob);
  });
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function uploadAudioToStorage(params: {
  chatId: string;
  senderId: string;
  blob: Blob;
  mimeType: string;
  extension: string;
  isPreviewMode?: boolean;
  onProgress?: (percent: number) => void;
  onTaskReady?: (cancelFn: () => void) => void;
}): Promise<string> {
  const { chatId, senderId, blob, mimeType, extension, isPreviewMode, onProgress, onTaskReady } = params;

  if (isPreviewMode) {
    let cancelled = false;
    onTaskReady?.(() => {
      cancelled = true;
    });
    onProgress?.(45);
    const dataUrl = await blobToDataUrl(blob);
    if (cancelled) {
      throw new Error('UPLOAD_CANCELLED');
    }
    onProgress?.(100);
    return dataUrl;
  }

  const timestamp = Date.now();
  const storagePath = `chats/${chatId}/audio/voice_${timestamp}_${senderId}.${extension}`;
  const storageRef = ref(storage, storagePath);
  const contentType = mimeType ? mimeType.split(';')[0] : 'audio/webm';

  const uploadTask: UploadTask = uploadBytesResumable(storageRef, blob, {
    contentType,
  });

  onTaskReady?.(() => {
    uploadTask.cancel();
  });

  return new Promise<string>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress?.(pct);
        }
      },
      (error: any) => {
        if (error?.code === 'storage/canceled') {
          reject(new Error('UPLOAD_CANCELLED'));
        } else if (error?.code === 'storage/unauthorized') {
          reject(new Error('Permission denied by Firebase Storage. Ensure Storage rules allow authenticated members.'));
        } else {
          reject(new Error(error?.message || 'Audio upload failed. Please check your connection and try again.'));
        }
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          onProgress?.(100);
          resolve(downloadUrl);
        } catch (err: any) {
          reject(new Error(err?.message || 'Failed to retrieve audio URL after upload.'));
        }
      }
    );
  });
}

export async function uploadFilesToStorage(params: {
  basePath: string;
  files: File[];
  uploaderId: string;
  uploaderName: string;
  isPreviewMode?: boolean;
  onProgress?: (percent: number) => void;
  onTaskReady?: (cancelFn: () => void) => void;
}): Promise<FileAttachment[]> {
  const { basePath, files, uploaderId, uploaderName, isPreviewMode, onProgress, onTaskReady } = params;

  if (files.length === 0) return [];

  let cancelled = false;
  let currentTask: UploadTask | null = null;

  onTaskReady?.(() => {
    cancelled = true;
    if (currentTask) {
      currentTask.cancel();
    }
  });

  const uploadedAttachments: FileAttachment[] = [];
  const totalBytesAllFiles = files.reduce((acc, f) => acc + Math.max(f.size, 1), 0);
  let completedBytesPriorFiles = 0;

  for (let i = 0; i < files.length; i++) {
    if (cancelled) {
      throw new Error('UPLOAD_CANCELLED');
    }

    const file = files[i];
    const ext = getFileExtension(file.name);
    const timestamp = Date.now();
    const safeName = sanitizeFileName(file.name);
    const storagePath = `${basePath}/${timestamp}_${i}_${safeName}`;

    if (isPreviewMode) {
      const dataUrl = await blobToDataUrl(file);
      if (cancelled) {
        throw new Error('UPLOAD_CANCELLED');
      }
      completedBytesPriorFiles += Math.max(file.size, 1);
      onProgress?.(Math.min(100, Math.round((completedBytesPriorFiles / totalBytesAllFiles) * 100)));

      uploadedAttachments.push({
        id: `att_${timestamp}_${i}`,
        name: file.name,
        type: file.type || 'application/octet-stream',
        extension: ext,
        size: file.size,
        url: dataUrl,
        storagePath,
        uploaderId,
        uploaderName,
        uploadedAt: timestamp,
      });
      continue;
    }

    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
    });
    currentTask = uploadTask;

    const downloadUrl = await new Promise<string>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const currentFileBytes = snapshot.bytesTransferred;
          const overallPct = Math.min(
            99,
            Math.round(((completedBytesPriorFiles + currentFileBytes) / totalBytesAllFiles) * 100)
          );
          onProgress?.(overallPct);
        },
        (error: any) => {
          if (error?.code === 'storage/canceled' || cancelled) {
            reject(new Error('UPLOAD_CANCELLED'));
          } else if (error?.code === 'storage/unauthorized') {
            reject(new Error('Permission denied by Firebase Storage. Ensure Storage rules allow authenticated uploads under 15 MB.'));
          } else {
            reject(new Error(error?.message || `Failed to upload "${file.name}". Please try again.`));
          }
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (err: any) {
            reject(new Error(err?.message || `Failed to get download URL for "${file.name}".`));
          }
        }
      );
    });

    completedBytesPriorFiles += Math.max(file.size, 1);
    onProgress?.(Math.min(100, Math.round((completedBytesPriorFiles / totalBytesAllFiles) * 100)));

    uploadedAttachments.push({
      id: `att_${timestamp}_${i}`,
      name: file.name,
      type: file.type || 'application/octet-stream',
      extension: ext,
      size: file.size,
      url: downloadUrl,
      storagePath,
      uploaderId,
      uploaderName,
      uploadedAt: timestamp,
    });
  }

  return uploadedAttachments;
}
