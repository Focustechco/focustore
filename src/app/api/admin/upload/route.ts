import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'path';
import {
  imageDestination,
  limitedFormData,
  MAX_IMAGE_BYTES,
  sanitizeImage,
  UploadInputError,
} from '@/lib/security/upload';

export async function POST(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const formData = await limitedFormData(request);
    const file = formData.get('file');
    const folder = formData.get('folder') || 'uploads';

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: 'Nenhum arquivo enviado.' },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'A imagem deve ter até 5 MB.' },
        { status: 400 }
      );
    }

    if (typeof folder !== 'string') {
      return NextResponse.json({ success: false, error: 'Pasta de destino inválida.' }, { status: 400 });
    }

    const original = Buffer.from(await file.arrayBuffer());
    const sanitized = await sanitizeImage(original, file.type);
    const destination = imageDestination(folder, sanitized, 'image/webp');
    await mkdir(path.dirname(destination.filePath), { recursive: true });
    await writeFile(destination.filePath, sanitized, { flag: 'wx' });

    return NextResponse.json({
      success: true,
      url: destination.url,
      fileName: path.basename(destination.filePath),
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (error instanceof UploadInputError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: 'Erro ao processar upload.' },
      { status: 500 }
    );
  }
}
