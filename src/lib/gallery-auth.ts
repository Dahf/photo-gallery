import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { env } from './env';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const secret = new TextEncoder().encode(env.AUTH_SECRET);

export const galleryCookieName = (slug: string) => `g_${slug}`;
export const clientSessionCookie = 'g_session';

export async function signGalleryToken(slug: string, ttlDays = 30) {
  return new SignJWT({ slug })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlDays}d`)
    .sign(secret);
}

export async function verifyGalleryToken(token: string, expectedSlug: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.slug === expectedSlug;
  } catch {
    return false;
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hasGalleryAccess(slug: string, passwordHash: string | null): Promise<boolean> {
  if (!passwordHash) return true;
  const cookieStore = await cookies();
  const token = cookieStore.get(galleryCookieName(slug))?.value;
  if (!token) return false;
  return verifyGalleryToken(token, slug);
}

// Read-only — safe to call from Server Components (the public gallery page).
// Returns null if the visitor has no client-session cookie yet.
export async function readClientSession(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(clientSessionCookie)?.value ?? null;
}

// Read-or-create — only safe in Server Actions or Route Handlers (mutating
// cookies in a Server Component throws in Next.js 16).
export async function getOrSetClientSession(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(clientSessionCookie)?.value;
  if (existing) return existing;
  const id = nanoid(24);
  cookieStore.set(clientSessionCookie, id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
  return id;
}
