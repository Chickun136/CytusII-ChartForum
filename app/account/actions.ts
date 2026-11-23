'use server';

import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteAvatar, saveAvatar } from '@/lib/avatar';
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  verifyPassword,
} from '@/lib/auth';
import type { FormState } from '@/lib/auth-types';
import { prisma } from '@/lib/prisma';
import { isMaster } from '@/lib/roles';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: FormDataEntryValue | null) {
  return String(value ?? '').trim().toLowerCase();
}

function nicknameFromEmail(email: string) {
  const local = email.split('@')[0] ?? 'Player';
  return (local.slice(0, 20) || 'Player').trim();
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(formData.get('email'));
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (!EMAIL_PATTERN.test(email)) return { error: '请输入有效的邮箱地址。' };
  if (password.length < 8) return { error: '密码至少需要 8 个字符。' };
  if (password.length > 128) return { error: '密码不能超过 128 个字符。' };
  if (password !== confirm) return { error: '两次输入的密码不一致。' };

  try {
    const count = await prisma.user.count();
    const role = count === 0 ? 'MASTER' : 'PLAYER';
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        nickname: nicknameFromEmail(email),
        role,
      },
    });
    await createSession(user.id);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { error: '该邮箱已注册，请直接登录。' };
    }
    console.error(error);
    return { error: '注册失败，请稍后重试。' };
  }

  revalidatePath('/', 'layout');
  redirect('/account');
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = normalizeEmail(formData.get('email'));
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: '请输入邮箱和密码。' };

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return { error: '邮箱或密码错误。' };
    }
    await createSession(user.id);
  } catch (error) {
    console.error(error);
    return { error: '登录失败，请稍后重试。' };
  }

  revalidatePath('/', 'layout');
  redirect('/account');
}

export async function logoutAction() {
  await destroySession();
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function updateNicknameAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: '请先登录。' };

  const nickname = String(formData.get('nickname') ?? '').trim();
  if (nickname.length < 2 || nickname.length > 20) {
    return { error: '昵称需要 2–20 个字符。' };
  }

  try {
    await prisma.user.update({ where: { id: user.id }, data: { nickname } });
  } catch (error) {
    console.error(error);
    return { error: '昵称更新失败，请稍后重试。' };
  }

  revalidatePath('/account');
  revalidatePath('/');
  return { success: '昵称已更新。' };
}

export async function updateAvatarAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: '请先登录。' };

  const file = formData.get('avatar');
  if (!(file instanceof File) || file.size === 0) {
    return { error: '请选择图片文件。' };
  }

  try {
    const avatarUrl = await saveAvatar(user.id, file);
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
    await deleteAvatar(user.avatarUrl);
  } catch (error) {
    return { error: error instanceof Error ? error.message : '头像上传失败。' };
  }

  revalidatePath('/account');
  revalidatePath('/');
  return { success: '头像已更新。' };
}

export async function setRoleAction(formData: FormData) {
  const actor = await getCurrentUser();
  if (!actor || !isMaster(actor.role)) redirect('/account');

  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '');
  if (role !== 'ADMIN' && role !== 'PLAYER') return;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role === 'MASTER' || target.id === actor.id) return;

  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath('/admin');
}
