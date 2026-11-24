import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const MAX_AVATAR_BYTES = 1024 * 1024;

const avatarDir = process.env.AVATAR_DIR
  ? path.resolve(process.env.AVATAR_DIR)
  : path.join(process.cwd(), 'data', 'avatars');

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

function detectExtension(buffer: Buffer): 'png' | 'jpg' | 'webp' | null {
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

export async function saveAvatar(userId: string, file: File) {
  if (!file || file.size === 0) throw new Error('请选择图片文件。');
  if (file.size > MAX_AVATAR_BYTES) throw new Error('头像不能超过 1 MB。');

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = detectExtension(buffer);
  if (!extension) throw new Error('仅支持 PNG / JPG / WebP 图片。');

  const fileName = `${userId}-${Date.now()}-${randomBytes(4).toString('hex')}.${extension}`;
  await fs.mkdir(avatarDir, { recursive: true });
  await fs.writeFile(path.join(avatarDir, fileName), buffer);
  return `/api/avatars/${fileName}`;
}

export function avatarFilePath(file: string) {
  if (!/^[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(file)) return null;
  return path.join(avatarDir, file);
}

export function avatarContentType(file: string) {
  const extension = file.split('.').pop() ?? '';
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

export async function deleteAvatar(url: string | null) {
  if (!url || !url.startsWith('/api/avatars/')) return;
  const file = url.slice('/api/avatars/'.length);
  const filePath = avatarFilePath(file);
  if (!filePath) return;
  await fs.rm(filePath, { force: true });
}
