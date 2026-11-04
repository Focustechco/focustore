import { randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp, { type Metadata } from 'sharp';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 64 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;

export class UploadInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadInputError';
  }
}

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
};

function hasExpectedSignature(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case 'image/jpeg':
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/png':
      return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case 'image/webp':
      return buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    case 'image/avif':
      return buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp' &&
        /^(avif|avis)$/.test(buffer.toString('ascii', 8, 12));
    default:
      return false;
  }
}

export function imageDestination(
  folder: string,
  buffer: Buffer,
  mimeType: string,
  publicRoot = path.join(process.cwd(), 'public'),
): { filePath: string; url: string } {
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new UploadInputError('A imagem deve ter até 5 MB.');
  }
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension || !hasExpectedSignature(buffer, mimeType)) {
    throw new UploadInputError('Formato de imagem inválido ou incompatível com o conteúdo enviado.');
  }
  if (
    typeof folder !== 'string' ||
    !folder ||
    folder.includes('\\') ||
    folder.startsWith('/') ||
    folder.split('/').some((part) => !/^[a-zA-Z0-9_-]+$/.test(part))
  ) {
    throw new UploadInputError('Pasta de destino inválida.');
  }

  const root = path.resolve(/*turbopackIgnore: true*/ publicRoot);
  const targetDirectory = path.resolve(root, folder);
  if (!targetDirectory.startsWith(`${root}${path.sep}`)) {
    throw new UploadInputError('Pasta de destino inválida.');
  }

  const fileName = `${randomUUID()}${extension}`;
  return {
    filePath: path.join(/*turbopackIgnore: true*/ targetDirectory, fileName),
    url: `/${folder}/${fileName}`,
  };
}

export async function sanitizeImage(input: Buffer, expectedMime?: string): Promise<Buffer> {
  if (input.length === 0 || input.length > MAX_IMAGE_BYTES) {
    throw new UploadInputError('A imagem deve ter até 5 MB.');
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
  } catch {
    throw new UploadInputError('O arquivo enviado não é uma imagem válida.');
  }

  const expectedFormat = expectedMime === 'image/jpg' ? 'jpeg' : expectedMime?.slice(6);
  if (
    !metadata.format ||
    !['jpeg', 'png', 'webp', 'avif'].includes(metadata.format) ||
    (expectedFormat !== undefined && expectedFormat !== metadata.format) ||
    !metadata.width ||
    !metadata.height ||
    metadata.width * metadata.height > MAX_IMAGE_PIXELS ||
    (metadata.pages ?? 1) > 1
  ) {
    throw new UploadInputError('Envie uma imagem raster válida, não animada, de até 40 megapixels, com formato compatível.');
  }

  try {
    return await sharp(input, { failOn: 'error', limitInputPixels: MAX_IMAGE_PIXELS })
      .rotate()
      .webp({ quality: 85, effort: 4 })
      .toBuffer();
  } catch {
    throw new UploadInputError('Não foi possível processar a imagem enviada.');
  }
}

export async function limitedFormData(request: Request): Promise<FormData> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
    throw new UploadInputError('Envie o arquivo como formulário multipart.');
  }

  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new UploadInputError('O envio excede o limite permitido.');
  }
  if (!request.body) throw new UploadInputError('Nenhum arquivo enviado.');

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new UploadInputError('O envio excede o limite permitido.');
    }
    chunks.push(Buffer.from(value));
  }

  const headers = new Headers(request.headers);
  headers.delete('content-length');
  const boundedRequest = new Request(request.url, {
    method: 'POST',
    headers,
    body: new Blob([Buffer.concat(chunks)]),
  });
  try {
    return await boundedRequest.formData();
  } catch {
    throw new UploadInputError('Formulário de envio inválido.');
  }
}
