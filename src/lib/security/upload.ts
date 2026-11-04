import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/avif': '.avif',
};

function extensionFor(buffer: Buffer, mime: string): string {
  if (mime === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return '.png';
  if (mime === 'image/jpeg' && buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return '.jpg';
  if (mime === 'image/webp' && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return '.webp';
  if (mime === 'image/avif' && buffer.includes(Buffer.from('ftypavif'))) return '.avif';
  throw new Error('Image content does not match its MIME type.');
}

export function imageDestination(folder: string, buffer: Buffer, mime: string, root: string) {
  if (!MIME_EXTENSIONS[mime] || buffer.length > MAX_IMAGE_BYTES) throw new Error('Invalid image upload.');
  if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)*$/i.test(folder) || folder.includes('..')) throw new Error('Invalid upload folder.');
  const extension = extensionFor(buffer, mime);
  const filename = `${createHash('sha256').update(buffer).digest('hex').slice(0, 24)}${extension}`;
  const relative = path.posix.join(folder, filename);
  return { filePath: path.join(root, ...relative.split('/')), url: `/${relative}` };
}

export async function sanitizeImage(buffer: Buffer): Promise<Buffer> {
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error('Image is too large.');
  return sharp(buffer, { failOn: 'error' }).rotate().webp({ effort: 4 }).toBuffer();
}

export async function limitedFormData(request: Request): Promise<FormData> {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_IMAGE_BYTES + 64 * 1024) throw new Error('Request body is too large.');
  const body = await request.clone().arrayBuffer();
  if (body.byteLength > MAX_IMAGE_BYTES + 64 * 1024) throw new Error('Request body is too large.');
  return request.formData();
}
