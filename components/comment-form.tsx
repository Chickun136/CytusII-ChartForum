'use client';

import { useActionState, useId, useRef, useState } from 'react';
import {
  createCommentAction,
  type CommentActionState,
} from '@/app/songs/[id]/comment-actions';
import { compressImage, isSupportedImage, MAX_SOURCE_BYTES, MAX_UPLOAD_BYTES } from '@/lib/client-image';

type CommentFormProps = {
  songId: string;
  parentId?: string;
  compact?: boolean;
  placeholder?: string;
  submitLabel?: string;
};

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
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef(0);
  const imageInputId = useId();

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    const requestId = selectionRef.current + 1;
    selectionRef.current = requestId;

    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setLocalError(null);

    if (!file) return;
    if (file.size > MAX_SOURCE_BYTES) {
      input.value = '';
      setLocalError('图片不能超过 30 MB。');
      return;
    }
    if (!(await isSupportedImage(file))) {
      if (selectionRef.current !== requestId) return;
      input.value = '';
      setLocalError('仅支持 PNG / JPG / WebP 图片。');
      return;
    }

    setProcessing(true);
    try {
      const compressed = await compressImage(file);
      if (selectionRef.current !== requestId) return;
      if (compressed.size > MAX_UPLOAD_BYTES) {
        input.value = '';
        setLocalError('压缩后仍超过 5 MB，请换一张图片。');
        return;
      }
      const transfer = new DataTransfer();
      transfer.items.add(compressed);
      input.files = transfer.files;
      setPreview(URL.createObjectURL(compressed));
    } catch {
      if (selectionRef.current !== requestId) return;
      input.value = '';
      setLocalError('图片处理失败，请换一张图片重试。');
    } finally {
      if (selectionRef.current === requestId) setProcessing(false);
    }
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
        if (processing) {
          event.preventDefault();
          return;
        }
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
        <p className="text-xs text-zinc-600">最多 500 字 · 图片自动压缩至 1024px（原图 ≤ 30 MB）</p>
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
            disabled={pending || processing}
            className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"
          >
            {processing ? '压缩中…' : pending ? '发送中…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
