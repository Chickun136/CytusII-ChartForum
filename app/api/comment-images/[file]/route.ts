import { readFile } from 'node:fs/promises';
import { commentImageContentType, commentImageFilePath } from '@/lib/comment-image';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params;
  const filePath = commentImageFilePath(file);
  if (!filePath) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const data = await readFile(filePath);
    return new Response(data, {
      headers: {
        'Content-Type': commentImageContentType(file),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
