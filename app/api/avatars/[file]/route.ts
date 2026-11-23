import { readFile } from 'node:fs/promises';
import { avatarContentType, avatarFilePath } from '@/lib/avatar';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const filePath = avatarFilePath(file);
  if (!filePath) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const data = await readFile(filePath);
    return new Response(data, {
      headers: {
        'Content-Type': avatarContentType(file),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
