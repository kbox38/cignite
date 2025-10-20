/*
  # Fix LinkedIn Growth Platform - Complete Setup

  1. New Tables
    - `users` - User profiles with LinkedIn integration
    - `user_profiles` - Extended profile data from LinkedIn
    - `synergy_partners` - Partnership relationships with status tracking
    - `synergy_invitations` - Partnership invitations with notification system
    - `post_cache` - Cached LinkedIn posts for performance
    - `comment_cache` - Cached comments for analysis
    - `suggested_comments` - AI-generated comment suggestions
    - `content_ideas` - AI-generated content ideas
    - `analytics_cache` - Performance analytics caching
    - `user_settings` - User preferences and notifications

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Ensure data privacy and isolation

  3. Features
    - Real-time notifications for partnership invitations
    - Database-driven user search and management
    - Accurate engagement and content metrics
    - Comprehensive analytics caching
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table with LinkedIn integration
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  given_name text,
  family_name text,
  avatar_url text,
  linkedin_member_urn text UNIQUE,
  linkedin_profile_url text,
  headline text,
  industry text,
  location text,
  dma_active boolean DEFAULT false,
  dma_consent_date timestamptz,
  last_login timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Extended user profile data
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_completeness_score integer DEFAULT 0,
  total_connections integer DEFAULT 0,
  profile_views integer DEFAULT 0,
  search_appearances integer DEFAULT 0,
  skills jsonb DEFAULT '[]'::jsonb,
  experience jsonb DEFAULT '[]'::jsonb,
  education jsonb DEFAULT '[]'::jsonb,
  last_synced timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_profile UNIQUE (user_id)
);

-- Synergy partnership invitations with notification system
CREATE TABLE IF NOT EXISTS synergy_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitation_status text DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'cancelled')),
  message text,
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  
  CONSTRAINT unique_invitation UNIQUE (from_user_id, to_user_id),
  CONSTRAINT no_self_invitation CHECK (from_user_id != to_user_id)
);

-- Synergy partnerships (created when invitation is accepted)
CREATE TABLE IF NOT EXISTS synergy_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partnership_status text DEFAULT 'active' CHECK (partnership_status IN ('active', 'paused', 'ended')),
  engagement_score integer DEFAULT 0,
  last_interaction timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_partnership UNIQUE (a_user_id, b_user_id),
  CONSTRAINT no_self_partnership CHECK (a_user_id != b_user_id)
);

-- Post cache with enhanced engagement tracking
CREATE TABLE IF NOT EXISTS post_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_urn text NOT NULL,
  linkedin_post_id text,
  content text,
  media_type text DEFAULT 'TEXT',
  media_urls jsonb DEFAULT '[]'::jsonb,
  hashtags jsonb DEFAULT '[]'::jsonb,
  visibility text DEFAULT 'PUBLIC',
  published_at timestamptz,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  engagement_rate decimal(5,2) DEFAULT 0.00,
  repurpose_eligible boolean DEFAULT false,
  repurpose_date timestamptz,
  raw_data jsonb,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_post UNIQUE (user_id, post_urn)
);

-- Comment cache for analysis
CREATE TABLE IF NOT EXISTS comment_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_urn text NOT NULL,
  comment_urn text,
  message text,
  likes_count integer DEFAULT 0,
  created_at_ms bigint NOT NULL,
  raw_data jsonb,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- AI-generated comment suggestions
CREATE TABLE IF NOT EXISTS suggested_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_urn text NOT NULL,
  suggestion text NOT NULL,
  tone text DEFAULT 'professional',
  used boolean DEFAULT false,
  effectiveness_score integer,
  created_at timestamptz DEFAULT now(),
  used_at timestamptz
);

-- Content ideas and strategies
CREATE TABLE IF NOT EXISTS content_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  content_type text,
  industry_focus text,
  estimated_engagement integer DEFAULT 0,
  hashtags jsonb DEFAULT '[]'::jsonb,
  ai_confidence_score decimal(3,2) DEFAULT 0.00,
  idea_status text DEFAULT 'generated' CHECK (idea_status IN ('generated', 'in_progress', 'published', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Analytics cache for performance
CREATE TABLE IF NOT EXISTS analytics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  time_range text NOT NULL,
  data_type text NOT NULL,
  cached_data jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_cache UNIQUE (user_id, cache_key, time_range)
);

-- User settings and preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_preferences jsonb DEFAULT '{
    "email_notifications": true,
    "push_notifications": false,
    "synergy_alerts": true,
    "analytics_reports": true
  }'::jsonb,
  privacy_settings jsonb DEFAULT '{
    "profile_visibility": "public",
    "analytics_sharing": false
  }'::jsonb,
  dashboard_layout jsonb DEFAULT '{
    "widgets": ["profile_evaluation", "summary_kpis"],
    "theme": "light"
  }'::jsonb,
  timezone text DEFAULT 'UTC',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_users_linkedin_urn ON users(linkedin_member_urn);
CREATE INDEX IF NOT EXISTS idx_users_dma_active ON users(dma_active) WHERE dma_active = true;
CREATE INDEX IF NOT EXISTS idx_users_name_search ON users USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_search ON users USING gin(email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_synergy_invitations_to_user ON synergy_invitations(to_user_id, invitation_status);
CREATE INDEX IF NOT EXISTS idx_synergy_invitations_from_user ON synergy_invitations(from_user_id, invitation_status);

CREATE INDEX IF NOT EXISTS idx_synergy_partners_a_user ON synergy_partners(a_user_id);
CREATE INDEX IF NOT EXISTS idx_synergy_partners_b_user ON synergy_partners(b_user_id);

CREATE INDEX IF NOT EXISTS idx_post_cache_user_published ON post_cache(user_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_cache_repurpose ON post_cache(user_id, repurpose_eligible);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON analytics_cache(expires_at);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE synergy_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE synergy_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggested_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Users can search other users"
  ON users
  FOR SELECT
  TO authenticated
  USING (dma_active = true);

-- RLS Policies for user_profiles table
CREATE POLICY "Users can manage own profile"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- RLS Policies for synergy_invitations table
CREATE POLICY "Users can read their invitations"
  ON synergy_invitations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = from_user_id::text OR 
    auth.uid()::text = to_user_id::text
  );

CREATE POLICY "Users can create invitations"
  ON synergy_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = from_user_id::text);

CREATE POLICY "Users can update their invitations"
  ON synergy_invitations
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid()::text = from_user_id::text OR 
    auth.uid()::text = to_user_id::text
  );

-- RLS Policies for synergy_partners table
CREATE POLICY "Users can read their partnerships"
  ON synergy_partners
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = a_user_id::text OR 
    auth.uid()::text = b_user_id::text
  );

CREATE POLICY "Users can manage their partnerships"
  ON synergy_partners
  FOR ALL
  TO authenticated
  USING (
    auth.uid()::text = a_user_id::text OR 
    auth.uid()::text = b_user_id::text
  );

-- RLS Policies for post_cache table
CREATE POLICY "Users can manage their own cached posts"
  ON post_cache
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Partners can read each other's cached posts"
  ON post_cache
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM synergy_partners sp
      WHERE ((sp.a_user_id::text = auth.uid()::text AND sp.b_user_id = user_id)
         OR (sp.b_user_id::text = auth.uid()::text AND sp.a_user_id = user_id))
        AND sp.partnership_status = 'active'
    )
  );

-- RLS Policies for other tables
CREATE POLICY "Users can manage their own data" ON comment_cache FOR ALL TO authenticated USING (auth.uid()::text = author_user_id::text);
CREATE POLICY "Users can manage their own data" ON suggested_comments FOR ALL TO authenticated USING (auth.uid()::text = from_user_id::text OR auth.uid()::text = to_user_id::text);
CREATE POLICY "Users can manage their own data" ON content_ideas FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage their own data" ON analytics_cache FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage their own data" ON user_settings FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);

-- Functions for automatic updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_synergy_partners_updated_at BEFORE UPDATE ON synergy_partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_cache_updated_at BEFORE UPDATE ON post_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_ideas_updated_at BEFORE UPDATE ON content_ideas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate repurpose eligibility
CREATE OR REPLACE FUNCTION update_repurpose_eligibility()
RETURNS TRIGGER AS $$
BEGIN
  NEW.repurpose_eligible = (
    NEW.published_at IS NOT NULL AND 
    NEW.published_at <= (now() - interval '45 days')
  );
  
  IF NEW.repurpose_eligible AND NEW.repurpose_date IS NULL THEN
    NEW.repurpose_date = NEW.published_at + interval '45 days';
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_post_repurpose_eligibility 
  BEFORE INSERT OR UPDATE ON post_cache
  FOR EACH ROW EXECUTE FUNCTION update_repurpose_eligibility();

-- Function to create partnership when invitation is accepted
CREATE OR REPLACE FUNCTION create_partnership_on_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create partnership when status changes to 'accepted'
  IF NEW.invitation_status = 'accepted' AND OLD.invitation_status != 'accepted' THEN
    -- Ensure consistent ordering (smaller ID first)
    INSERT INTO synergy_partners (a_user_id, b_user_id, created_at)
    VALUES (
      LEAST(NEW.from_user_id, NEW.to_user_id),
      GREATEST(NEW.from_user_id, NEW.to_user_id),
      now()
    )
    ON CONFLICT (a_user_id, b_user_id) DO NOTHING;
    
    NEW.responded_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_partnership_trigger
  BEFORE UPDATE ON synergy_invitations
  FOR EACH ROW EXECUTE FUNCTION create_partnership_on_acceptance();

-- Function to create default user settings
CREATE OR REPLACE FUNCTION create_default_user_data()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id) VALUES (NEW.id);
  INSERT INTO user_profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_user_defaults
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_default_user_data();

-- View for user search with DMA filtering
CREATE OR REPLACE VIEW searchable_users AS
SELECT 
  u.id,
  u.name,
  u.email,
  u.avatar_url,
  u.headline,
  u.industry,
  u.location,
  u.linkedin_member_urn,
  u.dma_active,
  up.total_connections,
  u.created_at
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.dma_active = true;

-- View for partnership management
CREATE OR REPLACE VIEW user_partnerships AS
SELECT 
  sp.id as partnership_id,
  sp.a_user_id,
  sp.b_user_id,
  sp.partnership_status,
  sp.engagement_score,
  sp.last_interaction,
  sp.created_at,
  a_user.name as a_user_name,
  a_user.avatar_url as a_user_avatar,
  b_user.name as b_user_name,
  b_user.avatar_url as b_user_avatar
FROM synergy_partners sp
JOIN users a_user ON sp.a_user_id = a_user.id
JOIN users b_user ON sp.b_user_id = b_user.id
WHERE sp.partnership_status = 'active';

-- View for pending invitations with user details
CREATE OR REPLACE VIEW pending_invitations AS
SELECT 
  si.id,
  si.from_user_id,
  si.to_user_id,
  si.invitation_status,
  si.message,
  si.created_at,
  from_user.name as from_user_name,
  from_user.avatar_url as from_user_avatar,
  from_user.headline as from_user_headline,
  to_user.name as to_user_name,
  to_user.avatar_url as to_user_avatar
FROM synergy_invitations si
JOIN users from_user ON si.from_user_id = from_user.id
JOIN users to_user ON si.to_user_id = to_user.id
WHERE si.invitation_status = 'pending';