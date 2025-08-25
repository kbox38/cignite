/*
  # Complete LinkedIn Growth SaaS Platform Setup

  1. New Tables
    - `users` - User profiles with LinkedIn integration and DMA consent tracking
    - `user_profiles` - Extended user profile data from LinkedIn
    - `synergy_invitations` - Partnership invitations with notification system
    - `synergy_partners` - Partnership relationships with status tracking
    - `post_cache` - Cached LinkedIn posts for performance optimization
    - `comment_cache` - Cached comments for cross-partner analysis
    - `suggested_comments` - AI-generated comment suggestions with effectiveness tracking
    - `content_ideas` - AI-generated content ideas and strategies
    - `posting_schedules` - User posting schedules and preferences
    - `analytics_cache` - Performance-optimized analytics caching
    - `algorithm_scores` - Historical algorithm performance tracking
    - `engagement_metrics` - Detailed engagement tracking per post
    - `hashtag_performance` - Hashtag usage and performance tracking
    - `content_templates` - Reusable content templates
    - `user_settings` - User preferences and configuration

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Ensure partners can only see each other's shared data
    - Implement data isolation and privacy controls

  3. Features
    - Real-time notifications for partnership invitations
    - Database-driven user search and management
    - Accurate engagement and content metrics
    - Comprehensive analytics caching
    - Automatic partnership creation on invitation acceptance
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table with LinkedIn integration and DMA tracking
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  given_name text,
  family_name text,
  avatar_url text,
  linkedin_member_urn text UNIQUE, -- e.g., "urn:li:person:ABC123"
  linkedin_profile_url text,
  headline text,
  industry text,
  location text,
  linkedin_access_token_hash text, -- Hashed for security
  dma_active boolean DEFAULT false,
  dma_consent_date timestamptz,
  last_login timestamptz DEFAULT now(),
  account_status text DEFAULT 'active' CHECK (account_status IN ('active', 'suspended', 'deleted')),
  subscription_tier text DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Extended user profile data from LinkedIn
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  headline text,
  summary text,
  industry text,
  location text,
  current_position text,
  current_company text,
  profile_completeness_score integer DEFAULT 0 CHECK (profile_completeness_score >= 0 AND profile_completeness_score <= 100),
  total_connections integer DEFAULT 0,
  profile_views integer DEFAULT 0,
  search_appearances integer DEFAULT 0,
  linkedin_profile_url text,
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

-- Synergy partnerships with enhanced tracking (created when invitation is accepted)
CREATE TABLE IF NOT EXISTS synergy_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partnership_status text DEFAULT 'active' CHECK (partnership_status IN ('active', 'paused', 'ended')),
  partnership_type text DEFAULT 'mutual' CHECK (partnership_type IN ('mutual', 'mentor', 'mentee')),
  engagement_score integer DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  last_interaction timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure no duplicate partnerships and no self-partnerships
  CONSTRAINT unique_partnership UNIQUE (a_user_id, b_user_id),
  CONSTRAINT no_self_partnership CHECK (a_user_id != b_user_id)
);

-- Enhanced post cache with analytics data
CREATE TABLE IF NOT EXISTS post_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_urn text NOT NULL,
  linkedin_post_id text,
  content text,
  media_type text DEFAULT 'TEXT' CHECK (media_type IN ('TEXT', 'IMAGE', 'VIDEO', 'ARTICLE', 'CAROUSEL', 'POLL')),
  media_urls jsonb DEFAULT '[]'::jsonb,
  hashtags jsonb DEFAULT '[]'::jsonb,
  mentions jsonb DEFAULT '[]'::jsonb,
  visibility text DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'CONNECTIONS', 'PRIVATE')),
  published_at timestamptz,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  engagement_rate decimal(5,2) DEFAULT 0.00,
  reach_score integer DEFAULT 0,
  algorithm_score integer DEFAULT 0,
  repurpose_eligible boolean DEFAULT false,
  repurpose_date timestamptz,
  raw_data jsonb,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_post UNIQUE (user_id, post_urn)
);

-- Enhanced comment cache for cross-partner analysis
CREATE TABLE IF NOT EXISTS comment_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_urn text NOT NULL,
  comment_urn text,
  message text,
  parent_comment_id uuid REFERENCES comment_cache(id),
  likes_count integer DEFAULT 0,
  replies_count integer DEFAULT 0,
  sentiment_score decimal(3,2), -- -1.00 to 1.00
  engagement_quality text CHECK (engagement_quality IN ('low', 'medium', 'high')),
  created_at_ms bigint NOT NULL,
  raw_data jsonb,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_comment UNIQUE (author_user_id, comment_urn)
);

-- AI-generated comment suggestions with tracking
CREATE TABLE IF NOT EXISTS suggested_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_urn text NOT NULL,
  suggestion text NOT NULL,
  tone text DEFAULT 'professional' CHECK (tone IN ('professional', 'casual', 'supportive', 'questioning')),
  used boolean DEFAULT false,
  effectiveness_score integer CHECK (effectiveness_score >= 1 AND effectiveness_score <= 10),
  ai_model text DEFAULT 'gpt-4o-mini',
  generation_context jsonb,
  created_at timestamptz DEFAULT now(),
  used_at timestamptz,
  
  CONSTRAINT unique_suggestion UNIQUE (from_user_id, to_user_id, post_urn, created_at)
);

-- AI-generated content ideas and strategies
CREATE TABLE IF NOT EXISTS content_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  content_type text CHECK (content_type IN ('post', 'article', 'carousel', 'video', 'poll')),
  industry_focus text,
  target_audience text,
  estimated_engagement integer DEFAULT 0,
  hashtags jsonb DEFAULT '[]'::jsonb,
  optimal_posting_time text,
  ai_confidence_score decimal(3,2) DEFAULT 0.00,
  idea_status text DEFAULT 'generated' CHECK (idea_status IN ('generated', 'in_progress', 'published', 'archived')),
  used_for_post_id uuid REFERENCES post_cache(id),
  ai_model text DEFAULT 'gpt-4o-mini',
  generation_prompt text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User posting schedules and preferences
CREATE TABLE IF NOT EXISTS posting_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schedule_name text NOT NULL,
  frequency_per_week integer DEFAULT 3 CHECK (frequency_per_week >= 1 AND frequency_per_week <= 14),
  preferred_days jsonb DEFAULT '[]'::jsonb, -- Array of day numbers (0-6)
  preferred_times jsonb DEFAULT '[]'::jsonb, -- Array of hour numbers (0-23)
  content_mix jsonb DEFAULT '{}'::jsonb, -- Percentage breakdown of content types
  auto_schedule boolean DEFAULT false,
  timezone text DEFAULT 'UTC',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_schedule_name UNIQUE (user_id, schedule_name)
);

-- Analytics cache for performance optimization
CREATE TABLE IF NOT EXISTS analytics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  time_range text NOT NULL CHECK (time_range IN ('7d', '30d', '90d', '1y')),
  data_type text NOT NULL CHECK (data_type IN ('dashboard', 'analytics', 'trends', 'engagement')),
  cached_data jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_cache UNIQUE (user_id, cache_key, time_range)
);

-- Algorithm performance tracking
CREATE TABLE IF NOT EXISTS algorithm_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  overall_grade text CHECK (overall_grade IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F')),
  posting_frequency_score integer CHECK (posting_frequency_score >= 0 AND posting_frequency_score <= 10),
  engagement_rate_score integer CHECK (engagement_rate_score >= 0 AND engagement_rate_score <= 10),
  content_diversity_score integer CHECK (content_diversity_score >= 0 AND content_diversity_score <= 10),
  consistency_score integer CHECK (consistency_score >= 0 AND consistency_score <= 10),
  reach_score integer CHECK (reach_score >= 0 AND reach_score <= 10),
  posts_per_week decimal(4,2) DEFAULT 0.00,
  avg_engagement_per_post decimal(8,2) DEFAULT 0.00,
  estimated_reach integer DEFAULT 0,
  ai_recommendations text,
  improvement_areas jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_daily_score UNIQUE (user_id, measurement_date)
);

-- Detailed engagement metrics per post
CREATE TABLE IF NOT EXISTS engagement_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_cache_id uuid NOT NULL REFERENCES post_cache(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  saves_count integer DEFAULT 0,
  clicks_count integer DEFAULT 0,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  engagement_rate decimal(5,2) DEFAULT 0.00,
  click_through_rate decimal(5,2) DEFAULT 0.00,
  save_rate decimal(5,2) DEFAULT 0.00,
  comment_sentiment_avg decimal(3,2), -- Average sentiment of comments
  top_engaging_hours jsonb DEFAULT '[]'::jsonb,
  audience_demographics jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_post_daily_metrics UNIQUE (post_cache_id, metric_date)
);

-- Hashtag performance tracking
CREATE TABLE IF NOT EXISTS hashtag_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hashtag text NOT NULL,
  usage_count integer DEFAULT 1,
  total_impressions integer DEFAULT 0,
  total_engagement integer DEFAULT 0,
  avg_engagement_per_use decimal(8,2) DEFAULT 0.00,
  best_performing_post_id uuid REFERENCES post_cache(id),
  industry_relevance_score integer CHECK (industry_relevance_score >= 0 AND industry_relevance_score <= 100),
  trending_score integer DEFAULT 0,
  last_used timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_hashtag UNIQUE (user_id, hashtag)
);

-- Reusable content templates
CREATE TABLE IF NOT EXISTS content_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  template_type text CHECK (template_type IN ('post', 'comment', 'article', 'carousel')),
  content_template text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb, -- Template variables like {industry}, {name}
  category text,
  tags jsonb DEFAULT '[]'::jsonb,
  usage_count integer DEFAULT 0,
  avg_engagement decimal(8,2) DEFAULT 0.00,
  is_public boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_template_name UNIQUE (user_id, template_name)
);

-- User settings and preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_preferences jsonb DEFAULT '{
    "email_notifications": true,
    "push_notifications": false,
    "synergy_alerts": true,
    "analytics_reports": true,
    "ai_suggestions": true
  }'::jsonb,
  privacy_settings jsonb DEFAULT '{
    "profile_visibility": "public",
    "analytics_sharing": false,
    "partner_data_sharing": true
  }'::jsonb,
  ai_preferences jsonb DEFAULT '{
    "content_tone": "professional",
    "suggestion_frequency": "medium",
    "auto_generate_ideas": true
  }'::jsonb,
  dashboard_layout jsonb DEFAULT '{
    "widgets": ["profile_evaluation", "summary_kpis", "mini_trends"],
    "theme": "light",
    "sidebar_collapsed": false
  }'::jsonb,
  timezone text DEFAULT 'UTC',
  language text DEFAULT 'en',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- Performance indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_users_linkedin_urn ON users(linkedin_member_urn);
CREATE INDEX IF NOT EXISTS idx_users_dma_active ON users(dma_active) WHERE dma_active = true;
CREATE INDEX IF NOT EXISTS idx_users_email_trgm ON users USING gin(email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_industry ON user_profiles(industry);
CREATE INDEX IF NOT EXISTS idx_user_profiles_completeness ON user_profiles(profile_completeness_score DESC);

CREATE INDEX IF NOT EXISTS idx_synergy_invitations_to_user ON synergy_invitations(to_user_id, invitation_status);
CREATE INDEX IF NOT EXISTS idx_synergy_invitations_from_user ON synergy_invitations(from_user_id, invitation_status);

CREATE INDEX IF NOT EXISTS idx_synergy_partners_a_user ON synergy_partners(a_user_id);
CREATE INDEX IF NOT EXISTS idx_synergy_partners_b_user ON synergy_partners(b_user_id);
CREATE INDEX IF NOT EXISTS idx_synergy_partners_status ON synergy_partners(partnership_status);
CREATE INDEX IF NOT EXISTS idx_synergy_partners_active ON synergy_partners(a_user_id, b_user_id) WHERE partnership_status = 'active';

CREATE INDEX IF NOT EXISTS idx_post_cache_user_published ON post_cache(user_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_cache_repurpose ON post_cache(user_id, repurpose_eligible, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_cache_engagement ON post_cache(user_id, engagement_rate DESC);
CREATE INDEX IF NOT EXISTS idx_post_cache_media_type ON post_cache(user_id, media_type);

CREATE INDEX IF NOT EXISTS idx_comment_cache_author_created ON comment_cache(author_user_id, created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_comment_cache_post_urn ON comment_cache(post_urn);

CREATE INDEX IF NOT EXISTS idx_suggested_comments_lookup ON suggested_comments(from_user_id, to_user_id, post_urn);
CREATE INDEX IF NOT EXISTS idx_suggested_comments_unused ON suggested_comments(from_user_id, used) WHERE used = false;

CREATE INDEX IF NOT EXISTS idx_content_ideas_user_status ON content_ideas(user_id, idea_status);
CREATE INDEX IF NOT EXISTS idx_content_ideas_industry ON content_ideas(industry_focus);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_user_key ON analytics_cache(user_id, cache_key);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON analytics_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_algorithm_scores_user_date ON algorithm_scores(user_id, measurement_date DESC);
CREATE INDEX IF NOT EXISTS idx_algorithm_scores_grade ON algorithm_scores(overall_grade);

CREATE INDEX IF NOT EXISTS idx_engagement_metrics_post_date ON engagement_metrics(post_cache_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_user_date ON engagement_metrics(user_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_hashtag_performance_user_score ON hashtag_performance(user_id, avg_engagement_per_use DESC);
CREATE INDEX IF NOT EXISTS idx_hashtag_performance_trending ON hashtag_performance(trending_score DESC);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE synergy_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE synergy_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggested_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE algorithm_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE hashtag_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;
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

CREATE POLICY "Partners can read each other's profiles"
  ON user_profiles
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

CREATE POLICY "Users can create partnerships"
  ON synergy_partners
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = a_user_id::text OR 
    auth.uid()::text = b_user_id::text
  );

CREATE POLICY "Users can update their partnerships"
  ON synergy_partners
  FOR UPDATE
  TO authenticated
  USING (
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

-- RLS Policies for comment_cache table
CREATE POLICY "Users can manage their own cached comments"
  ON comment_cache
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = author_user_id::text);

CREATE POLICY "Partners can read each other's cached comments"
  ON comment_cache
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM synergy_partners sp
      WHERE ((sp.a_user_id::text = auth.uid()::text AND sp.b_user_id = author_user_id)
         OR (sp.b_user_id::text = auth.uid()::text AND sp.a_user_id = author_user_id))
        AND sp.partnership_status = 'active'
    )
  );

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

CREATE POLICY "Users can update their suggested comments"
  ON suggested_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = from_user_id::text);

-- RLS Policies for content_ideas table
CREATE POLICY "Users can manage their content ideas"
  ON content_ideas
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- RLS Policies for posting_schedules table
CREATE POLICY "Users can manage their posting schedules"
  ON posting_schedules
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- RLS Policies for analytics_cache table
CREATE POLICY "Users can manage their analytics cache"
  ON analytics_cache
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- RLS Policies for algorithm_scores table
CREATE POLICY "Users can read their algorithm scores"
  ON algorithm_scores
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "System can insert algorithm scores"
  ON algorithm_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id::text);

-- RLS Policies for engagement_metrics table
CREATE POLICY "Users can read their engagement metrics"
  ON engagement_metrics
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "System can manage engagement metrics"
  ON engagement_metrics
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- RLS Policies for hashtag_performance table
CREATE POLICY "Users can manage their hashtag performance"
  ON hashtag_performance
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

-- RLS Policies for content_templates table
CREATE POLICY "Users can manage their content templates"
  ON content_templates
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can read public templates"
  ON content_templates
  FOR SELECT
  TO authenticated
  USING (is_public = true);

-- RLS Policies for user_settings table
CREATE POLICY "Users can manage their settings"
  ON user_settings
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text);

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

CREATE TRIGGER update_posting_schedules_updated_at BEFORE UPDATE ON posting_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hashtag_performance_updated_at BEFORE UPDATE ON hashtag_performance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_templates_updated_at BEFORE UPDATE ON content_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate repurpose eligibility
CREATE OR REPLACE FUNCTION update_repurpose_eligibility()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate if post is eligible for repurposing (45+ days old)
  NEW.repurpose_eligible = (
    NEW.published_at IS NOT NULL AND 
    NEW.published_at <= (now() - interval '45 days')
  );
  
  -- Set repurpose date if eligible
  IF NEW.repurpose_eligible AND NEW.repurpose_date IS NULL THEN
    NEW.repurpose_date = NEW.published_at + interval '45 days';
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for automatic repurpose eligibility calculation
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

-- Trigger for automatic partnership creation
CREATE TRIGGER create_partnership_trigger
  BEFORE UPDATE ON synergy_invitations
  FOR EACH ROW EXECUTE FUNCTION create_partnership_on_acceptance();

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  -- Clean expired analytics cache
  DELETE FROM analytics_cache WHERE expires_at < now();
  
  -- Clean old comment cache (older than 7 days)
  DELETE FROM comment_cache WHERE fetched_at < (now() - interval '7 days');
  
  -- Clean old suggested comments (older than 30 days and unused)
  DELETE FROM suggested_comments 
  WHERE created_at < (now() - interval '30 days') AND used = false;
END;
$$ language 'plpgsql';

-- Function to calculate engagement rate
CREATE OR REPLACE FUNCTION calculate_engagement_rate(
  likes integer,
  comments integer,
  shares integer,
  impressions integer
)
RETURNS decimal(5,2) AS $$
BEGIN
  IF impressions > 0 THEN
    RETURN ROUND(((likes + comments + shares)::decimal / impressions::decimal) * 100, 2);
  ELSE
    -- Fallback calculation when impressions not available
    RETURN ROUND((likes + comments + shares)::decimal, 2);
  END IF;
END;
$$ language 'plpgsql';

-- Function to update algorithm scores
CREATE OR REPLACE FUNCTION update_algorithm_scores(user_uuid uuid)
RETURNS void AS $$
DECLARE
  posts_count integer;
  avg_engagement decimal;
  posting_frequency decimal;
  content_diversity integer;
  overall_grade text;
BEGIN
  -- Calculate metrics from post_cache
  SELECT 
    COUNT(*),
    AVG(likes_count + comments_count + shares_count),
    COUNT(*) / GREATEST(EXTRACT(days FROM (MAX(published_at) - MIN(published_at))) / 7, 1),
    COUNT(DISTINCT media_type)
  INTO posts_count, avg_engagement, posting_frequency, content_diversity
  FROM post_cache 
  WHERE user_id = user_uuid 
    AND published_at >= (now() - interval '30 days');
  
  -- Calculate overall grade
  IF posting_frequency >= 4 AND avg_engagement >= 20 THEN
    overall_grade = 'A+';
  ELSIF posting_frequency >= 3 AND avg_engagement >= 15 THEN
    overall_grade = 'A';
  ELSIF posting_frequency >= 2 AND avg_engagement >= 10 THEN
    overall_grade = 'B+';
  ELSIF posting_frequency >= 1 AND avg_engagement >= 5 THEN
    overall_grade = 'B';
  ELSE
    overall_grade = 'C';
  END IF;
  
  -- Insert or update algorithm scores
  INSERT INTO algorithm_scores (
    user_id,
    overall_grade,
    posts_per_week,
    avg_engagement_per_post
  ) VALUES (
    user_uuid,
    overall_grade,
    posting_frequency,
    avg_engagement
  )
  ON CONFLICT (user_id, measurement_date)
  DO UPDATE SET
    overall_grade = EXCLUDED.overall_grade,
    posts_per_week = EXCLUDED.posts_per_week,
    avg_engagement_per_post = EXCLUDED.avg_engagement_per_post,
    updated_at = now();
END;
$$ language 'plpgsql';

-- Insert default user settings for new users
CREATE OR REPLACE FUNCTION create_default_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id) VALUES (NEW.id);
  INSERT INTO user_profiles (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to create default settings for new users
CREATE TRIGGER create_user_defaults
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_default_user_settings();

-- Views for common queries
CREATE OR REPLACE VIEW user_dashboard_summary AS
SELECT 
  u.id,
  u.name,
  u.email,
  up.headline,
  up.industry,
  up.total_connections,
  up.profile_completeness_score,
  COUNT(pc.id) as total_posts,
  AVG(pc.engagement_rate) as avg_engagement_rate,
  COUNT(sp.id) as synergy_partners_count,
  als.overall_grade as current_algorithm_grade
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN post_cache pc ON u.id = pc.user_id AND pc.published_at >= (now() - interval '30 days')
LEFT JOIN synergy_partners sp ON (u.id = sp.a_user_id OR u.id = sp.b_user_id) AND sp.partnership_status = 'active'
LEFT JOIN algorithm_scores als ON u.id = als.user_id AND als.measurement_date = CURRENT_DATE
GROUP BY u.id, u.name, u.email, up.headline, up.industry, up.total_connections, up.profile_completeness_score, als.overall_grade;

-- View for partner analytics
CREATE OR REPLACE VIEW partner_engagement_summary AS
SELECT 
  sp.id as partnership_id,
  sp.a_user_id,
  sp.b_user_id,
  COUNT(sc.id) as total_suggested_comments,
  COUNT(CASE WHEN sc.used = true THEN 1 END) as used_suggestions,
  AVG(sc.effectiveness_score) as avg_effectiveness,
  sp.engagement_score,
  sp.last_interaction
FROM synergy_partners sp
LEFT JOIN suggested_comments sc ON (
  (sp.a_user_id = sc.from_user_id AND sp.b_user_id = sc.to_user_id) OR
  (sp.b_user_id = sc.from_user_id AND sp.a_user_id = sc.to_user_id)
)
WHERE sp.partnership_status = 'active'
GROUP BY sp.id, sp.a_user_id, sp.b_user_id, sp.engagement_score, sp.last_interaction;

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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;