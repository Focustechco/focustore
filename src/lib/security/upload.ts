import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { InputError } from './input-error';
import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FOLDERS = new Set(['uploads', 'images/products', 'images/banners', 'images/community']);

export async function sanitizeImage(bytes: Buffer): Promise<Buffer> {
  try {
    // Decode the full image, bound decompression, remove metadata and reject truncated files.
    const sanitized = await sharp(bytes, { limitInputPixels: 25000000, failOn: 'warning' }).rotate().toBuffer();
    if (sanitized.length > MAX_IMAGE_BYTES) throw new Error('Image too large');
    return sanitized;
  } catch {
    throw new InputError('Imagem inválida ou excede o limite de 25 milhões de pixels.');
  }
}

export function imageDestination(folder: string, bytes: Buffer, mime: string, root: string) {
  if (!FOLDERS.has(folder)) throw new InputError('Pasta de upload inválida.');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new InputError('Imagem deve ter até 5 MB.', 413);
  let extension: string | undefined;
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (mime === 'image/png') extension = 'png';
  } else if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    if (mime === 'image/jpeg' || mime === 'image/jpg') extension = 'jpg';
  } else if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    if (mime === 'image/webp') extension = 'webp';
  } else if (bytes.length >= 16 && bytes.toString('ascii', 4, 8) === 'ftyp' &&
             ['avif', 'avis'].includes(bytes.toString('ascii', 8, 12))) {
    if (mime === 'image/avif') extension = 'avif';
  }
  if (!extension) throw new InputError('Conteúdo inválido. Envie PNG, JPEG, WEBP ou AVIF; SVG não é permitido.');
  const filename = `${randomUUID()}.${extension}`;
  return { directory: path.join(root, folder), filename, url: `/${folder}/${filename}` };
}

export async function limitedFormData(request: Request): Promise<FormData> {
  if (!request.body) throw new InputError('Arquivo obrigatório.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES + 64 * 1024) {
        await reader.cancel();
        throw new InputError('Upload deve ter até 5 MB.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { 'content-type': request.headers.get('content-type') || '' },
    }).formData();
  } catch {
    throw new InputError('Formulário de upload inválido.');
  }
}
