import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);

  async function save(formData: FormData) {
    'use server';
    const s = await auth();
    if (!s?.user) redirect('/login');
    const name = String(formData.get('name') ?? '').trim() || null;
    const studioName = String(formData.get('studioName') ?? '').trim() || null;
    const brandColor = String(formData.get('brandColor') ?? '#111111');
    const logoUrl = String(formData.get('logoUrl') ?? '').trim() || null;
    await db.update(users).set({ name, studioName, brandColor, logoUrl }).where(eq(users.id, s.user.id));
    revalidatePath('/dashboard/settings');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <form action={save} className="space-y-5 rounded-lg border border-neutral-200 bg-white p-8">
        <Field label="Your name" name="name" defaultValue={user?.name ?? ''} />
        <Field label="Studio name" name="studioName" defaultValue={user?.studioName ?? ''} />
        <Field label="Logo URL" name="logoUrl" defaultValue={user?.logoUrl ?? ''} placeholder="https://..." />
        <label className="block">
          <span className="text-sm font-medium text-neutral-700">Brand color</span>
          <input
            type="color"
            name="brandColor"
            defaultValue={user?.brandColor ?? '#111111'}
            className="mt-1 h-10 w-20 rounded-md border border-neutral-300"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Save
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
      />
    </label>
  );
}
