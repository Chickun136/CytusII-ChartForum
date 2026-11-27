import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_COMMENT_IMAGE_BYTES = 5 * 1024 * 1024;

const commentImageDir = process.env.COMMENT_IMAGE_DIR
  ? path.resolve(process.env.COMMENT_IMAGE_DIR)
  : path.join(process.cwd(), 'data', 'comment-images');

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

export function detectImageExtension(buffer: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

export async function saveCommentImage(file: File) {
  if (!file || file.size === 0) throw new Error('请选择图片文件。');
  if (file.size > MAX_COMMENT_IMAGE_BYTES) throw new Error('图片不能超过 5 MB。');

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = detectImageExtension(buffer);
  if (!extension) throw new Error('仅支持 PNG / JPG / WebP 图片。');

  const fileName = `${Date.now()}-${randomBytes(6).toString('hex')}.${extension}`;
  await fs.mkdir(commentImageDir, { recursive: true });
  await fs.writeFile(path.join(commentImageDir, fileName), buffer);
  return `/api/comment-images/${fileName}`;
}

export function commentImageFilePath(file: string) {
  if (!/^[A-Za-z0-9-]+\.(png|jpg|jpeg|webp)$/.test(file)) return null;
  return path.join(commentImageDir, file);
}

export function commentImageContentType(file: string) {
  const extension = file.split('.').pop() ?? '';
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}
