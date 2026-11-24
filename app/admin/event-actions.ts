'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canAccessAdmin } from '@/lib/roles';

const EVENT_STATUSES = new Set(['DRAFT', 'PUBLISHED', 'WITHDRAWN']);

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.role)) redirect('/account');
  return user;
}

function parseDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readEventForm(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const startAt = parseDate(formData.get('startAt'));
  const endAt = parseDate(formData.get('endAt'));

  if (!title || title.length > 80) return { error: 'title' as const };
  if (description.length > 2000) return { error: 'description' as const };
  if (!startAt || !endAt) return { error: 'dates' as const };
  if (endAt.getTime() <= startAt.getTime()) return { error: 'range' as const };

  return { title, description, startAt, endAt };
}

export async function createEventAction(formData: FormData) {
  const actor = await requireAdmin();
  const parsed = readEventForm(formData);
  if ('error' in parsed) redirect(`/admin?tab=events&error=${parsed.error}`);

  const status = formData.get('publish') === 'on' ? 'PUBLISHED' : 'DRAFT';
  await prisma.event.create({
    data: {
      title: parsed.title,
      description: parsed.description,
      startAt: parsed.startAt,
      endAt: parsed.endAt,
      status,
      createdById: actor.id,
    },
  });

  revalidatePath('/admin');
  revalidatePath('/events');
  redirect('/admin?tab=events&notice=created');
}

export async function updateEventAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const parsed = readEventForm(formData);
  if (!id) redirect('/admin?tab=events&error=missing');
  if ('error' in parsed) redirect(`/admin?tab=events&error=${parsed.error}`);

  const event = await prisma.event.findUnique({ where: { id }, select: { id: true } });
  if (!event) redirect('/admin?tab=events&error=missing');

  await prisma.event.update({
    where: { id },
    data: {
      title: parsed.title,
      description: parsed.description,
      startAt: parsed.startAt,
      endAt: parsed.endAt,
    },
  });

  revalidatePath('/admin');
  revalidatePath('/events');
  redirect('/admin?tab=events&notice=updated');
}

export async function setEventStatusAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!id || !EVENT_STATUSES.has(status)) return;

  const event = await prisma.event.findUnique({ where: { id }, select: { id: true } });
  if (!event) return;

  await prisma.event.update({ where: { id }, data: { status } });

  revalidatePath('/admin');
  revalidatePath('/events');
  redirect(`/admin?tab=events&notice=${status.toLowerCase()}`);
}
