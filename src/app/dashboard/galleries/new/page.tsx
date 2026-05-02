import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { galleries } from '@/lib/db/schema';
import { hashPassword } from '@/lib/gallery-auth';
import { makeSlug } from '@/lib/slug';
import { redirect } from 'next/navigation';

export default function NewGalleryPage() {
  async function create(formData: FormData) {
    'use server';
    const session = await auth();
    if (!session?.user) redirect('/login');

    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim() || null;
    const password = String(formData.get('password') ?? '');
    const downloadEnabled = formData.get('downloadEnabled') === 'on';
    const favoritesEnabled = formData.get('favoritesEnabled') === 'on';

    if (!title) redirect('/dashboard/galleries/new?error=title');

    const passwordHash = password ? await hashPassword(password) : null;
    const slug = makeSlug(title);

    const [gallery] = await db
      .insert(galleries)
      .values({
        userId: session.user.id,
        slug,
        title,
        description,
        passwordHash,
        downloadEnabled,
        favoritesEnabled,
      })
      .returning({ id: galleries.id });

    redirect(`/dashboard/galleries/${gallery.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          <span className="h-px w-8 bg-accent" />
          <span>New gallery</span>
        </div>
        <h1 className="display mt-4 text-5xl text-text">Set up</h1>
      </div>

      <form action={create} className="space-y-6 border border-line bg-surface p-8">
        <Field label="Title" name="title" required placeholder="Müller wedding · Aug 2026" />
        <Field label="Description" name="description" placeholder="Optional · shown to client at top" />
        <Field
          label="Password (optional)"
          name="password"
          type="password"
          placeholder="Leave blank for an open link"
        />

        <div className="space-y-3 border-t border-line pt-5">
          <Toggle name="downloadEnabled" defaultChecked label="Allow client downloads (single + ZIP)" />
          <Toggle name="favoritesEnabled" defaultChecked label="Allow client favourites" />
        </div>

        <button type="submit" className="btn-primary mt-2 w-full justify-center">
          Create gallery
          <span aria-hidden>→</span>
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
      <input name={name} type={type} required={required} placeholder={placeholder} className="input mt-2" />
    </label>
  );
}

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-text">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}
