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
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">New gallery</h1>
      <form action={create} className="space-y-5 rounded-lg border border-neutral-200 bg-white p-8">
        <Field label="Title" name="title" required placeholder="Müller Family Wedding" />
        <Field label="Description" name="description" placeholder="Optional" />
        <Field label="Password (optional)" name="password" type="password" placeholder="Leave blank for no password" />
        <div className="flex flex-col gap-2 pt-2">
          <Toggle name="downloadEnabled" defaultChecked label="Allow client downloads" />
          <Toggle name="favoritesEnabled" defaultChecked label="Allow client favorites" />
        </div>
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Create gallery
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
      <span className="text-sm font-medium text-neutral-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
      />
    </label>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}
