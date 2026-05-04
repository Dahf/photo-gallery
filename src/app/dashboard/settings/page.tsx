import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { LogoUploader } from './logo-uploader';

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
    await db.update(users).set({ name, studioName }).where(eq(users.id, s.user.id));
    revalidatePath('/dashboard/settings');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          <span className="h-px w-8 bg-accent" />
          <span>Studio settings</span>
        </div>
        <h1 className="display mt-4 text-5xl text-text">Settings</h1>
      </div>

      <form action={save} className="space-y-6 border border-line bg-surface p-8">
        <Field label="Your name" name="name" defaultValue={user?.name ?? ''} />
        <Field label="Studio name" name="studioName" defaultValue={user?.studioName ?? ''} placeholder="Shown on every gallery" />
        <button type="submit" className="btn-primary mt-2">
          Save settings
          <span aria-hidden>→</span>
        </button>
      </form>

      <div className="border border-line bg-surface p-8">
        <LogoUploader currentUrl={user?.logoUrl ?? null} />
      </div>
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
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="input mt-2" />
    </label>
  );
}
