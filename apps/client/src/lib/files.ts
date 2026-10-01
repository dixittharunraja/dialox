export interface PendingAttachment {
  filename: string;
  contentType: string;
  base64: string;
  size: number;
}

const MAX_TOTAL_BYTES = 10 * 1024 * 1024;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function toAttachments(
  files: FileList | File[],
  existing: PendingAttachment[],
): Promise<PendingAttachment[]> {
  const list = Array.from(files);
  const total = [...existing.map((a) => a.size), ...list.map((f) => f.size)].reduce((a, b) => a + b, 0);
  if (total > MAX_TOTAL_BYTES) throw new Error('Attachments are limited to 10 MB per email');
  const added = await Promise.all(
    list.map(async (file) => ({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      base64: (await readAsDataUrl(file)).split(',')[1] ?? '',
      size: file.size,
    })),
  );
  return [...existing, ...added];
}

/** Downscales a profile photo to a square JPEG data URL so it stays small in the database. */
export async function avatarDataUrl(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const side = Math.min(bitmap.width, bitmap.height);
  canvas
    .getContext('2d')!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', 0.85);
}
