'use client';

import { useActionState, useId, useRef, useState } from 'react';
import {
  createCommentAction,
  type CommentActionState,
} from '@/app/songs/[id]/comment-actions';

type CommentFormProps = {
  songId: string;
  parentId?: string;
  compact?: boolean;
  placeholder?: string;
  submitLabel?: string;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function isSupportedImage(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const matches = (signature: number[], offset = 0) =>
    bytes.length >= offset + signature.length &&
    signature.every((value, index) => bytes[offset + index] === value);
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));

  return (
    matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
    matches([0xff, 0xd8, 0xff]) ||
    (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
  );
}

export function CommentForm({
  songId,
  parentId,
  compact = false,
  placeholder = '说点什么…',
  submitLabel = '发布',
}: CommentFormProps) {
  const [state, formAction, pending] = useActionState<CommentActionState, FormData>(
    createCommentAction,
    null,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageInputId = useId();

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (preview) URL.revokeObjectURL(preview);

    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      setPreview(null);
      return;
    }
    setLocalError(null);

    const reject = (message: string) => {
      input.value = '';
      setPreview(null);
      setLocalError(message);
    };

    if (file.size > MAX_IMAGE_BYTES) {
      reject('图片不能超过 5 MB。');
      return;
    }
    if (!(await isSupportedImage(file))) {
      if (input.files?.[0] === file) reject('仅支持 PNG / JPG / WebP 图片。');
      return;
    }
    if (input.files?.[0] !== file) return;
    setPreview(URL.createObjectURL(file));
  }

  function clearImage() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const form = event.currentTarget;
        const content = String(new FormData(form).get('content') ?? '').trim();
        const file = fileRef.current?.files?.[0];
        if (!content && !(file && file.size > 0)) {
          event.preventDefault();
          setLocalError('请输入评论内容或选择图片。');
          return;
        }
        setLocalError(null);
        if (preview) {
          URL.revokeObjectURL(preview);
          setPreview(null);
        }
      }}
    >
      <input type="hidden" name="songId" value={songId} />
      {parentId && <input type="hidden" name="parentId" value={parentId} />}
      <textarea
        name="content"
        maxLength={500}
        rows={compact ? 2 : 3}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10"
      />
      {preview && (
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="待上传图片预览"
            className="h-16 w-16 rounded object-cover"
          />
          <p className="text-xs text-zinc-500">图片将随评论一起发布</p>
          <button
            type="button"
            onClick={clearImage}
            className="ml-auto text-xs text-zinc-400 transition hover:text-rose-300"
          >
            移除图片
          </button>
        </div>
      )}
      {(localError || state?.error) && (
        <p className="mt-1.5 text-xs text-rose-300">{localError ?? state?.error}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-600">最多 500 字 · 图片支持 PNG / JPG / WebP，≤ 5 MB</p>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            id={imageInputId}
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageChange}
            className="hidden"
          />
          <label
            htmlFor={imageInputId}
            className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-cyan-500/60 hover:text-cyan-200"
          >
            选择图片
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? '发送中…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
