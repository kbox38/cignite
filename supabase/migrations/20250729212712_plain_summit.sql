/*
  # Create Synergy Feature Tables

  1. New Tables
    - `users` - User profiles with LinkedIn integration
    - `synergy_partners` - Mutual partnership relationships
    - `post_cache` - Cached LinkedIn posts for performance
    - `comment_cache` - Cached comments for cross-partner analysis
    - `suggested_comments` - AI-generated comment suggestions

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Ensure partners can only see each other's cached data

  3. Indexes
    - Optimize queries for partner relationships
    - Index cache tables for fast lookups
    - Add composite indexes for common query patterns
*/

-- Users table for LinkedIn integration
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  avatar_url text,
  linkedin_member_urn text, -- e.g., "urn:li:person:ABC"
  dma_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Synergy partnerships (mutual relationships)
CREATE TABLE IF NOT EXISTS synergy_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  
  -- Ensure no duplicate partnerships and no self-partnerships
  CONSTRAINT unique_partnership UNIQUE (a_user_id, b_user_id),
  CONSTRAINT no_self_partnership CHECK (a_user_id != b_user_id)
);

-- Post cache for performance optimization
CREATE TABLE IF NOT EXISTS post_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_urn text NOT NULL, -- urn:li:ugcPost:* or urn:li:share:*
  created_at_ms bigint NOT NULL, -- firstPublishedAt or created time
  text_preview text,
  media_type text, -- IMAGE | VIDEO | ARTICLE | NONE | URN_REFERENCE
  media_asset_urn text, -- urn:li:digitalmediaAsset:* when applicable
  permalink text, -- if available
  raw jsonb, -- trimmed LinkedIn object
  fetched_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_post UNIQUE (owner_user_id, post_urn)
);

-- Comment cache for cross-partner analysis
CREATE TABLE IF NOT EXISTS comment_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_urn text NOT NULL, -- post/article/activity the comment is attached to
  message text,
  created_at_ms bigint NOT NULL,
  raw jsonb,
  fetched_at timestamptz DEFAULT now()
);

-- AI-generated comment suggestions
CREATE TABLE IF NOT EXISTS suggested_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_urn text NOT NULL,
  suggestion text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_cache_owner_created ON post_cache(owner_user_id, created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_comment_cache_author_created ON comment_cache(author_user_id, created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_comment_cache_object_author ON comment_cache(object_urn, author_user_id);
CREATE INDEX IF NOT EXISTS idx_suggested_comments_lookup ON suggested_comments(from_user_id, to_user_id, post_urn);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE synergy_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggested_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can insert own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = id::text);

-- RLS Policies for synergy_partners table
CREATE POLICY "Users can read their partnerships"
  ON synergy_partners
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = a_user_id::text OR 
    auth.uid()::text = b_user_id::text
  );

CREATE POLICY "Users can create partnerships"
  ON synergy_partners
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = a_user_id::text OR 
    auth.uid()::text = b_user_id::text
  );

CREATE POLICY "Users can delete their partnerships"
  ON synergy_partners
  FOR DELETE
  TO authenticated
  USING (
    auth.uid()::text = a_user_id::text OR 
    auth.uid()::text = b_user_id::text
  );

-- RLS Policies for post_cache table
CREATE POLICY "Users can read their own cached posts"
  ON post_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = owner_user_id::text);

CREATE POLICY "Partners can read each other's cached posts"
  ON post_cache
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM synergy_partners sp
      WHERE (sp.a_user_id::text = auth.uid()::text AND sp.b_user_id = owner_user_id)
         OR (sp.b_user_id::text = auth.uid()::text AND sp.a_user_id = owner_user_id)
    )
  );

CREATE POLICY "Users can manage their own cached posts"
  ON post_cache
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = owner_user_id::text);

-- RLS Policies for comment_cache table
CREATE POLICY "Users can read their own cached comments"
  ON comment_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = author_user_id::text);

CREATE POLICY "Partners can read each other's cached comments"
  ON comment_cache
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM synergy_partners sp
      WHERE (sp.a_user_id::text = auth.uid()::text AND sp.b_user_id = author_user_id)
         OR (sp.b_user_id::text = auth.uid()::text AND sp.a_user_id = author_user_id)
    )
  );

CREATE POLICY "Users can manage their own cached comments"
  ON comment_cache
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = author_user_id::text);

-- RLS Policies for suggested_comments table
CREATE POLICY "Users can read their suggested comments"
  ON suggested_comments
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = from_user_id::text OR 
    auth.uid()::text = to_user_id::text
  );

CREATE POLICY "Users can create suggested comments"
  ON suggested_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = from_user_id::text);

CREATE POLICY "Users can delete their suggested comments"
  ON suggested_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = from_user_id::text);