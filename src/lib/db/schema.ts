import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  uuid,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  studioName: text('studio_name'),
  logoUrl: text('logo_url'),
  brandColor: text('brand_color').default('#111111'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const galleries = pgTable(
  'galleries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    coverPhotoId: uuid('cover_photo_id'),
    passwordHash: text('password_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    downloadEnabled: boolean('download_enabled').default(true).notNull(),
    favoritesEnabled: boolean('favorites_enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('galleries_slug_idx').on(t.slug)]
);

export const photos = pgTable(
  'photos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    galleryId: uuid('gallery_id')
      .notNull()
      .references(() => galleries.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    s3KeyOriginal: text('s3_key_original').notNull(),
    s3KeyWeb: text('s3_key_web').notNull(),
    s3KeyThumb: text('s3_key_thumb').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    takenAt: timestamp('taken_at', { withTimezone: true }),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('photos_gallery_idx').on(t.galleryId, t.sortOrder)]
);

export const favorites = pgTable(
  'favorites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    galleryId: uuid('gallery_id')
      .notNull()
      .references(() => galleries.id, { onDelete: 'cascade' }),
    photoId: uuid('photo_id')
      .notNull()
      .references(() => photos.id, { onDelete: 'cascade' }),
    clientSessionId: text('client_session_id').notNull(),
    clientName: text('client_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('favorites_unique_idx').on(t.photoId, t.clientSessionId),
    index('favorites_gallery_idx').on(t.galleryId),
  ]
);

export const customDomains = pgTable('custom_domains', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  galleryId: uuid('gallery_id').references(() => galleries.id, { onDelete: 'cascade' }),
  domain: text('domain').notNull().unique(),
  verified: boolean('verified').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  galleries: many(galleries),
}));

export const galleriesRelations = relations(galleries, ({ one, many }) => ({
  user: one(users, { fields: [galleries.userId], references: [users.id] }),
  photos: many(photos),
  favorites: many(favorites),
}));

export const photosRelations = relations(photos, ({ one, many }) => ({
  gallery: one(galleries, { fields: [photos.galleryId], references: [galleries.id] }),
  favorites: many(favorites),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  gallery: one(galleries, { fields: [favorites.galleryId], references: [galleries.id] }),
  photo: one(photos, { fields: [favorites.photoId], references: [photos.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Gallery = typeof galleries.$inferSelect;
export type NewGallery = typeof galleries.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type NewPhoto = typeof photos.$inferInsert;
export type Favorite = typeof favorites.$inferSelect;
