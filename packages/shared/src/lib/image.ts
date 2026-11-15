/**
 * Shared image compression and rendering utilities for web & mobile web.
 */

async function fileToDataUrlFallback(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an image File or Blob to a JPEG Blob/File with max dimensions and quality.
 * Shrinks raw 12MP-48MP camera captures (5-15MB) down to ~150KB-250KB in milliseconds.
 */
export async function compressImageFile(
  file: File | Blob,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.8,
): Promise<File | Blob> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return file;
  if (file.type && !file.type.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  if (file.size <= 200 * 1024) return file; // Already tiny

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (!width || !height) {
          resolve(file);
          return;
        }

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file);
              return;
            }
            const name = file instanceof File ? file.name.replace(/\.[^.]+$/, '.jpg') : 'upload.jpg';
            const compressed = new File([blob], name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressed);
          },
          'image/jpeg',
          quality,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    } catch {
      resolve(file);
    }
  });
}

/**
 * Compresses an image File or Blob directly into a compact base64 data URL.
 * Used for forms submitting base64 (e.g. self-registration selfie and ID cards).
 * Prevents massive 20MB base64 strings that freeze mobile React state and DOM rendering.
 */
export async function compressImageToDataUrl(
  file: File | Blob,
  maxWidth = 960,
  maxHeight = 960,
  quality = 0.75,
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return fileToDataUrlFallback(file);
  }
  if (file.type && !file.type.startsWith('image/')) {
    return fileToDataUrlFallback(file);
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (!width || !height) {
          fileToDataUrlFallback(file).then(resolve).catch(() => resolve(''));
          return;
        }

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          fileToDataUrlFallback(file).then(resolve).catch(() => resolve(''));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        fileToDataUrlFallback(file).then(resolve).catch(() => resolve(''));
      };
      img.src = url;
    } catch {
      fileToDataUrlFallback(file).then(resolve).catch(() => resolve(''));
    }
  });
}
