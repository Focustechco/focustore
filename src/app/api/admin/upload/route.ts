import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { imageDestination, limitedFormData, sanitizeImage } from '@/lib/security/upload';
import { InputError } from '@/lib/security/input-error';

export async function POST(request: Request) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.authorized) return authorization.response;
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return NextResponse.json({ error: 'Upload requer armazenamento persistente configurado.' }, { status: 503 });
    }
    const form = await limitedFormData(request);
    const file = form.get('file');
    if (!(file instanceof File)) throw new InputError('Nenhum arquivo enviado.');
    const folder = form.get('folder') ?? 'uploads';
    if (typeof folder !== 'string') throw new InputError('Pasta inválida.');
    const bytes = Buffer.from(await file.arrayBuffer());
    const target = imageDestination(folder, bytes, file.type,
                                    path.join(process.cwd(), 'public'));
    const sanitized = await sanitizeImage(bytes);
    await mkdir(target.directory, { recursive: true });
    await writeFile(path.join(target.directory, target.filename), sanitized, { flag: 'wx' });
    return NextResponse.json({ success: true, url: target.url, fileName: target.filename });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof InputError ? error.message : 'Erro ao processar upload.' },
                            { status: error instanceof InputError ? error.status : 500 });
  }
}
