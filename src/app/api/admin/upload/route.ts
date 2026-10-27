import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'uploads';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Nenhum arquivo enviado.' },
        { status: 400 }
      );
    }

    // Validate mime type
    const validMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/svg+xml',
      'image/jpg',
    ];
    if (!validMimes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Formato inválido. Envie imagens JPG, PNG, WEBP ou SVG.' },
        { status: 400 }
      );
    }

    // Convert file to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize filename
    const originalName = file.name
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '-');
    const ext = path.extname(originalName) || '.jpg';
    const baseName = path.basename(originalName, ext).slice(0, 30);
    const uniqueFilename = `${baseName}-${Date.now()}${ext}`;

    // Target directory: public/uploads or public/images/banners
    const targetDir = path.join(process.cwd(), 'public', folder);
    await mkdir(targetDir, { recursive: true });

    const filePath = path.join(targetDir, uniqueFilename);
    await writeFile(filePath, buffer);

    const publicUrl = `/${folder}/${uniqueFilename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: uniqueFilename,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao processar upload.' },
      { status: 500 }
    );
  }
}
