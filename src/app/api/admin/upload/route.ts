import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { imageDestination, limitedFormData, sanitizeImage } from '@/lib/security/upload';

export async function POST(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const formData = await limitedFormData(request);
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Nenhum arquivo enviado.' },
        { status: 400 }
      );
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/jpg'].includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Formato inválido. Envie imagens JPG, PNG, WEBP ou AVIF.' },
        { status: 400 }
      );
    }

    const buffer = await sanitizeImage(Buffer.from(await file.arrayBuffer()));
    const destination = imageDestination(folder, buffer, 'image/webp', path.join(process.cwd(), 'public'));
    await mkdir(path.dirname(destination.filePath), { recursive: true });
    await writeFile(destination.filePath, buffer, { flag: 'wx' });

    return NextResponse.json({
      success: true,
      url: destination.url,
      fileName: path.basename(destination.filePath),
    });
  } catch (error: unknown) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao processar upload.' },
      { status: 500 }
    );
  }
}
