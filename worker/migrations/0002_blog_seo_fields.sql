-- Migration: SEO metadata for blog posts.
-- D1/SQLite does not support ADD COLUMN IF NOT EXISTS; skip a line if that column already exists.

ALTER TABLE blog_posts ADD COLUMN focus_keyword TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN seo_title TEXT NOT NULL DEFAULT '';
ALTER TABLE blog_posts ADD COLUMN seo_description TEXT NOT NULL DEFAULT '';
