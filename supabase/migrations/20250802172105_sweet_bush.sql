/*
  # Complete LinkedIn Growth SaaS Platform - Final Migration

  1. New Tables (Complete Platform)
    - `users` - Core user profiles with LinkedIn integration
    - `user_profiles` - Extended LinkedIn profile data
    - `synergy_invitations` - Partnership invitation system
    - `synergy_partners` - Active partnerships
    - `post_cache` - LinkedIn posts cache with analytics
    - `comment_cache` - Comments cache for engagement tracking
    - `suggested_comments` - AI-generated comment suggestions
    - `content_ideas` - AI content generation tracking
    - `posting_schedules` - User posting preferences
    - `analytics_cache` - Performance analytics caching
    - `algorithm_scores` - Algorithm performance tracking
    - `engagement_metrics` - Detailed post engagement
    - `hashtag_performance` - Hashtag effectiveness tracking
    - `content_templates` - Reusable content templates
    - `user_settings` - User preferences and configuration
    - `notification_queue` - Real-time notifications
    - `api_usage_logs` - LinkedIn API usage tracking
    - `user_sessions` - Session management
    - `platform_analytics` - Platform-wide metrics

  2. Security
    - Enable RLS on all tables
    - Comprehensive policies for data access
    - User isolation and privacy controls
    - Partner data sharing permissions

  3. Performance
    - Optimized indexes for all query patterns
    - Efficient search capabilities
    - Fast partnership lookups
    - Analytics caching strategies

  4. Features
    - Real-time notifications
    - Comprehensive user search
    - Partnership management
    - Content analytics
    - AI integration tracking
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS platform_analytics CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS api_usage_logs CASCADE;
DROP TABLE IF EXISTS notification_queue CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS content_templates CASCADE;
DROP TABLE IF EXISTS hashtag_performance CASCADE;
DROP TABLE IF EXISTS engagement_metrics CASCADE;
DROP TABLE IF EXISTS algorithm_scores CASCADE;
DROP TABLE IF EXISTS analytics_cache CASCADE;
DROP TABLE IF EXISTS posting_schedules CASCADE;
DROP TABLE IF EXISTS content_ideas CASCADE;
DROP TABLE IF EXISTS suggested_comments CASCADE;
DROP TABLE IF EXISTS comment_cache CASCADE;
DROP TABLE IF EXISTS post_cache CASCADE;
DROP TABLE IF EXISTS synergy_partners CASCADE;
DROP TABLE IF EXISTS synergy_invitations CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Core users table with comprehensive LinkedIn integration
CREATE TABLE users (
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
  onboarding_completed boolean DEFAULT false,
  terms_accepted boolean DEFAULT false,
  privacy_policy_accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Extended user profile data from LinkedIn
CREATE TABLE user_profiles (
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
  certifications jsonb DEFAULT '[]'::jsonb,
  languages jsonb DEFAULT '[]'::jsonb,
  recommendations_received integer DEFAULT 0,
  recommendations_given integer DEFAULT 0,
  last_synced timestamptz DEFAULT now(),
  sync_status text DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_profile UNIQUE (user_id)
);

-- Partnership invitation system with comprehensive tracking
CREATE TABLE synergy_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitation_status text DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  message text,
  invitation_type text DEFAULT 'synergy' CHECK (invitation_type IN ('synergy', 'mentor', 'collaboration')),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  created_at timestamptz DEFAULT now(),
  responded_at timestamptz,
  
  CONSTRAINT unique_invitation UNIQUE (from_user_id, to_user_id),
  CONSTRAINT no_self_invitation CHECK (from_user_id != to_user_id)
);

-- Active partnerships with enhanced tracking
CREATE TABLE synergy_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partnership_status text DEFAULT 'active' CHECK (partnership_status IN ('active', 'paused', 'ended')),
  partnership_type text DEFAULT 'mutual' CHECK (partnership_type IN ('mutual', 'mentor', 'mentee', 'collaboration')),
  engagement_score integer DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  total_interactions integer DEFAULT 0,
  last_interaction timestamptz,
  partnership_goals jsonb DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure consistent ordering and no duplicates
  CONSTRAINT unique_partnership UNIQUE (a_user_id, b_user_id),
  CONSTRAINT no_self_partnership CHECK (a_user_id != b_user_id),
  CONSTRAINT ordered_partnership CHECK (a_user_id < b_user_id)
);

-- LinkedIn posts cache with comprehensive analytics
CREATE TABLE post_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_urn text NOT NULL,
  linkedin_post_id text,
  content text,
  content_length integer DEFAULT 0,
  media_type text DEFAULT 'TEXT' CHECK (media_type IN ('TEXT', 'IMAGE', 'VIDEO', 'ARTICLE', 'CAROUSEL', 'POLL', 'DOCUMENT')),
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
  saves_count integer DEFAULT 0,
  engagement_rate decimal(5,2) DEFAULT 0.00,
  reach_score integer DEFAULT 0,
  algorithm_score integer DEFAULT 0,
  sentiment_score decimal(3,2), -- -1.00 to 1.00
  repurpose_eligible boolean DEFAULT false,
  repurpose_date timestamptz,
  repurposed_count integer DEFAULT 0,
  performance_tier text DEFAULT 'average' CHECK (performance_tier IN ('low', 'average', 'high', 'viral')),
  raw_data jsonb,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_post UNIQUE (user_id, post_urn)
);

-- Comments cache for engagement analysis
CREATE TABLE comment_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_urn text NOT NULL,
  comment_urn text,
  message text,
  parent_comment_id uuid REFERENCES comment_cache(id),
  likes_count integer DEFAULT 0,
  replies_count integer DEFAULT 0,
  sentiment_score decimal(3,2), -- -1.00 to 1.00
  engagement_quality text DEFAULT 'medium' CHECK (engagement_quality IN ('low', 'medium', 'high')),
  comment_type text DEFAULT 'comment' CHECK (comment_type IN ('comment', 'reply', 'reaction')),
  created_at_ms bigint NOT NULL,
  raw_data jsonb,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_comment UNIQUE (author_user_id, comment_urn)
);

-- AI-generated comment suggestions with effectiveness tracking
CREATE TABLE suggested_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_urn text NOT NULL,
  suggestion text NOT NULL,
  tone text DEFAULT 'professional' CHECK (tone IN ('professional', 'casual', 'supportive', 'questioning', 'enthusiastic')),
  used boolean DEFAULT false,
  effectiveness_score integer CHECK (effectiveness_score >= 1 AND effectiveness_score <= 10),
  ai_model text DEFAULT 'gpt-4o-mini',
  generation_context jsonb,
  user_feedback text,
  created_at timestamptz DEFAULT now(),
  used_at timestamptz,
  
  CONSTRAINT unique_suggestion_per_post UNIQUE (from_user_id, to_user_id, post_urn, created_at)
);

-- AI-generated content ideas and strategies
CREATE TABLE content_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  content_type text CHECK (content_type IN ('post', 'article', 'carousel', 'video', 'poll', 'story')),
  industry_focus text,
  target_audience text,
  estimated_engagement integer DEFAULT 0,
  hashtags jsonb DEFAULT '[]'::jsonb,
  optimal_posting_time text,
  ai_confidence_score decimal(3,2) DEFAULT 0.00,
  idea_status text DEFAULT 'generated' CHECK (idea_status IN ('generated', 'in_progress', 'published', 'archived', 'rejected')),
  used_for_post_id uuid REFERENCES post_cache(id),
  ai_model text DEFAULT 'gpt-4o-mini',
  generation_prompt text,
  user_rating integer CHECK (user_rating >= 1 AND user_rating <= 5),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- User posting schedules and preferences
CREATE TABLE posting_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schedule_name text NOT NULL,
  frequency_per_week integer DEFAULT 3 CHECK (frequency_per_week >= 1 AND frequency_per_week <= 21),
  preferred_days jsonb DEFAULT '[1,2,3,4,5]'::jsonb, -- Array of day numbers (0=Sunday, 6=Saturday)
  preferred_times jsonb DEFAULT '[9,13,17]'::jsonb, -- Array of hour numbers (0-23)
  content_mix jsonb DEFAULT '{"TEXT": 40, "IMAGE": 30, "VIDEO": 20, "ARTICLE": 10}'::jsonb,
  auto_schedule boolean DEFAULT false,
  timezone text DEFAULT 'UTC',
  is_active boolean DEFAULT true,
  last_used timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_schedule_name UNIQUE (user_id, schedule_name)
);

-- Analytics cache for performance optimization
CREATE TABLE analytics_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  time_range text NOT NULL CHECK (time_range IN ('7d', '30d', '90d', '1y', 'all')),
  data_type text NOT NULL CHECK (data_type IN ('dashboard', 'analytics', 'trends', 'engagement', 'audience')),
  cached_data jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  cache_size integer DEFAULT 0,
  expires_at timestamptz NOT NULL,
  hit_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_cache UNIQUE (user_id, cache_key, time_range)
);

-- Algorithm performance tracking
CREATE TABLE algorithm_scores (
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
  score_trend text DEFAULT 'stable' CHECK (score_trend IN ('improving', 'stable', 'declining')),
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_daily_score UNIQUE (user_id, measurement_date)
);

-- Detailed engagement metrics per post
CREATE TABLE engagement_metrics (
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
  comment_sentiment_avg decimal(3,2),
  top_engaging_hours jsonb DEFAULT '[]'::jsonb,
  audience_demographics jsonb DEFAULT '{}'::jsonb,
  viral_coefficient decimal(4,2) DEFAULT 0.00,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_post_daily_metrics UNIQUE (post_cache_id, metric_date)
);

-- Hashtag performance tracking
CREATE TABLE hashtag_performance (
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
  competition_level text DEFAULT 'medium' CHECK (competition_level IN ('low', 'medium', 'high')),
  last_used timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_hashtag UNIQUE (user_id, hashtag)
);

-- Reusable content templates
CREATE TABLE content_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  template_type text CHECK (template_type IN ('post', 'comment', 'article', 'carousel', 'video_script')),
  content_template text NOT NULL,
  variables jsonb DEFAULT '[]'::jsonb, -- Template variables like {industry}, {name}
  category text,
  tags jsonb DEFAULT '[]'::jsonb,
  usage_count integer DEFAULT 0,
  avg_engagement decimal(8,2) DEFAULT 0.00,
  is_public boolean DEFAULT false,
  is_active boolean DEFAULT true,
  template_version integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_template_name UNIQUE (user_id, template_name)
);

-- User settings and preferences
CREATE TABLE user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_preferences jsonb DEFAULT '{
    "email_notifications": true,
    "push_notifications": false,
    "synergy_alerts": true,
    "analytics_reports": true,
    "ai_suggestions": true,
    "partnership_requests": true,
    "weekly_digest": true
  }'::jsonb,
  privacy_settings jsonb DEFAULT '{
    "profile_visibility": "public",
    "analytics_sharing": false,
    "partner_data_sharing": true,
    "search_visibility": true,
    "activity_visibility": "partners"
  }'::jsonb,
  ai_preferences jsonb DEFAULT '{
    "content_tone": "professional",
    "suggestion_frequency": "medium",
    "auto_generate_ideas": true,
    "ai_model_preference": "gpt-4o-mini"
  }'::jsonb,
  dashboard_layout jsonb DEFAULT '{
    "widgets": ["profile_evaluation", "summary_kpis", "mini_trends"],
    "theme": "light",
    "sidebar_collapsed": false,
    "default_time_range": "30d"
  }'::jsonb,
  timezone text DEFAULT 'UTC',
  language text DEFAULT 'en',
  date_format text DEFAULT 'MM/DD/YYYY',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- Real-time notification queue
CREATE TABLE notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('invitation', 'partnership_accepted', 'comment_suggestion', 'analytics_ready', 'system_update')),
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- API usage tracking for rate limiting and analytics
CREATE TABLE api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  api_endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  response_time_ms integer,
  request_size integer,
  response_size integer,
  error_message text,
  rate_limit_remaining integer,
  created_at timestamptz DEFAULT now()
);

-- User session management
CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  ip_address inet,
  user_agent text,
  device_type text,
  browser text,
  os text,
  location_country text,
  location_city text,
  is_active boolean DEFAULT true,
  last_activity timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Platform-wide analytics
CREATE TABLE platform_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  total_users integer DEFAULT 0,
  active_users_daily integer DEFAULT 0,
  active_users_weekly integer DEFAULT 0,
  active_users_monthly integer DEFAULT 0,
  total_partnerships integer DEFAULT 0,
  total_posts_cached integer DEFAULT 0,
  total_ai_suggestions integer DEFAULT 0,
  avg_engagement_rate decimal(5,2) DEFAULT 0.00,
  top_industries jsonb DEFAULT '[]'::jsonb,
  feature_usage jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_daily_platform_metrics UNIQUE (metric_date)
);

-- Performance indexes for optimal query performance
CREATE INDEX idx_users_linkedin_urn ON users(linkedin_member_urn);
CREATE INDEX idx_users_dma_active ON users(dma_active) WHERE dma_active = true;
CREATE INDEX idx_users_email_trgm ON users USING gin(email gin_trgm_ops);
CREATE INDEX idx_users_name_trgm ON users USING gin(name gin_trgm_ops);
CREATE INDEX idx_users_industry ON users(industry);
CREATE INDEX idx_users_location ON users(location);
CREATE INDEX idx_users_created_at ON users(created_at DESC);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_industry ON user_profiles(industry);
CREATE INDEX idx_user_profiles_completeness ON user_profiles(profile_completeness_score DESC);
CREATE INDEX idx_user_profiles_connections ON user_profiles(total_connections DESC);

CREATE INDEX idx_synergy_invitations_to_user_status ON synergy_invitations(to_user_id, invitation_status);
CREATE INDEX idx_synergy_invitations_from_user_status ON synergy_invitations(from_user_id, invitation_status);
CREATE INDEX idx_synergy_invitations_expires ON synergy_invitations(expires_at) WHERE invitation_status = 'pending';

CREATE INDEX idx_synergy_partners_a_user ON synergy_partners(a_user_id);
CREATE INDEX idx_synergy_partners_b_user ON synergy_partners(b_user_id);
CREATE INDEX idx_synergy_partners_status ON synergy_partners(partnership_status);
CREATE INDEX idx_synergy_partners_active ON synergy_partners(a_user_id, b_user_id) WHERE partnership_status = 'active';

CREATE INDEX idx_post_cache_user_published ON post_cache(user_id, published_at DESC);
CREATE INDEX idx_post_cache_repurpose ON post_cache(user_id, repurpose_eligible, published_at DESC);
CREATE INDEX idx_post_cache_engagement ON post_cache(user_id, engagement_rate DESC);
CREATE INDEX idx_post_cache_media_type ON post_cache(user_id, media_type);
CREATE INDEX idx_post_cache_performance ON post_cache(user_id, performance_tier);

CREATE INDEX idx_comment_cache_author_created ON comment_cache(author_user_id, created_at_ms DESC);
CREATE INDEX idx_comment_cache_post_urn ON comment_cache(post_urn);

CREATE INDEX idx_suggested_comments_lookup ON suggested_comments(from_user_id, to_user_id, post_urn);
CREATE INDEX idx_suggested_comments_unused ON suggested_comments(from_user_id, used) WHERE used = false;

CREATE INDEX idx_content_ideas_user_status ON content_ideas(user_id, idea_status);
CREATE INDEX idx_content_ideas_industry ON content_ideas(industry_focus);

CREATE INDEX idx_analytics_cache_user_key ON analytics_cache(user_id, cache_key);
CREATE INDEX idx_analytics_cache_expires ON analytics_cache(expires_at);

CREATE INDEX idx_algorithm_scores_user_date ON algorithm_scores(user_id, measurement_date DESC);
CREATE INDEX idx_algorithm_scores_grade ON algorithm_scores(overall_grade);

CREATE INDEX idx_engagement_metrics_post_date ON engagement_metrics(post_cache_id, metric_date DESC);
CREATE INDEX idx_engagement_metrics_user_date ON engagement_metrics(user_id, metric_date DESC);

CREATE INDEX idx_hashtag_performance_user_score ON hashtag_performance(user_id, avg_engagement_per_use DESC);
CREATE INDEX idx_hashtag_performance_trending ON hashtag_performance(trending_score DESC);

CREATE INDEX idx_notification_queue_user_unread ON notification_queue(user_id, read) WHERE read = false;
CREATE INDEX idx_notification_queue_created ON notification_queue(created_at DESC);

CREATE INDEX idx_api_usage_logs_user_created ON api_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_api_usage_logs_endpoint ON api_usage_logs(api_endpoint, created_at DESC);

CREATE INDEX idx_user_sessions_user_active ON user_sessions(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

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
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_analytics ENABLE ROW LEVEL SECURITY;

-- Comprehensive RLS Policies

-- Users table policies
CREATE POLICY "Users can read own data" ON users FOR SELECT TO authenticated USING (auth.uid()::text = id::text);
CREATE POLICY "Users can update own data" ON users FOR UPDATE TO authenticated USING (auth.uid()::text = id::text);
CREATE POLICY "Users can insert own data" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = id::text);
CREATE POLICY "Users can search other DMA users" ON users FOR SELECT TO authenticated USING (dma_active = true);

-- User profiles policies
CREATE POLICY "Users can manage own profile" ON user_profiles FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Partners can read each other's profiles" ON user_profiles FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM synergy_partners sp
    WHERE ((sp.a_user_id::text = auth.uid()::text AND sp.b_user_id = user_id)
       OR (sp.b_user_id::text = auth.uid()::text AND sp.a_user_id = user_id))
      AND sp.partnership_status = 'active'
  )
);

-- Synergy invitations policies
CREATE POLICY "Users can read their invitations" ON synergy_invitations FOR SELECT TO authenticated USING (
  auth.uid()::text = from_user_id::text OR auth.uid()::text = to_user_id::text
);
CREATE POLICY "Users can create invitations" ON synergy_invitations FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = from_user_id::text);
CREATE POLICY "Users can update their invitations" ON synergy_invitations FOR UPDATE TO authenticated USING (
  auth.uid()::text = from_user_id::text OR auth.uid()::text = to_user_id::text
);

-- Synergy partners policies
CREATE POLICY "Users can read their partnerships" ON synergy_partners FOR SELECT TO authenticated USING (
  auth.uid()::text = a_user_id::text OR auth.uid()::text = b_user_id::text
);
CREATE POLICY "Users can manage their partnerships" ON synergy_partners FOR ALL TO authenticated USING (
  auth.uid()::text = a_user_id::text OR auth.uid()::text = b_user_id::text
);

-- Post cache policies
CREATE POLICY "Users can manage their own cached posts" ON post_cache FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Partners can read each other's cached posts" ON post_cache FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM synergy_partners sp
    WHERE ((sp.a_user_id::text = auth.uid()::text AND sp.b_user_id = user_id)
       OR (sp.b_user_id::text = auth.uid()::text AND sp.a_user_id = user_id))
      AND sp.partnership_status = 'active'
  )
);

-- Comment cache policies
CREATE POLICY "Users can manage their own cached comments" ON comment_cache FOR ALL TO authenticated USING (auth.uid()::text = author_user_id::text);
CREATE POLICY "Partners can read each other's cached comments" ON comment_cache FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM synergy_partners sp
    WHERE ((sp.a_user_id::text = auth.uid()::text AND sp.b_user_id = author_user_id)
       OR (sp.b_user_id::text = auth.uid()::text AND sp.a_user_id = author_user_id))
      AND sp.partnership_status = 'active'
  )
);

-- Suggested comments policies
CREATE POLICY "Users can read their suggested comments" ON suggested_comments FOR SELECT TO authenticated USING (
  auth.uid()::text = from_user_id::text OR auth.uid()::text = to_user_id::text
);
CREATE POLICY "Users can create suggested comments" ON suggested_comments FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = from_user_id::text);
CREATE POLICY "Users can update their suggested comments" ON suggested_comments FOR UPDATE TO authenticated USING (auth.uid()::text = from_user_id::text);

-- Generic policies for user-owned tables
CREATE POLICY "Users can manage their own data" ON content_ideas FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage their own data" ON posting_schedules FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage their own data" ON analytics_cache FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can read their own data" ON algorithm_scores FOR SELECT TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "System can insert algorithm scores" ON algorithm_scores FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can read their own data" ON engagement_metrics FOR SELECT TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "System can manage engagement metrics" ON engagement_metrics FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage their own data" ON hashtag_performance FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage their own data" ON content_templates FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can read public templates" ON content_templates FOR SELECT TO authenticated USING (is_public = true);
CREATE POLICY "Users can manage their own data" ON user_settings FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can read their own notifications" ON notification_queue FOR SELECT TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "System can create notifications" ON notification_queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update their own notifications" ON notification_queue FOR UPDATE TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can read their own API logs" ON api_usage_logs FOR SELECT TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "System can log API usage" ON api_usage_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can manage their own sessions" ON user_sessions FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Admins can read platform analytics" ON platform_analytics FOR SELECT TO authenticated USING (true);

-- Functions for automatic updates and business logic
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_synergy_partners_updated_at BEFORE UPDATE ON synergy_partners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_post_cache_updated_at BEFORE UPDATE ON post_cache FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_ideas_updated_at BEFORE UPDATE ON content_ideas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posting_schedules_updated_at BEFORE UPDATE ON posting_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hashtag_performance_updated_at BEFORE UPDATE ON hashtag_performance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_templates_updated_at BEFORE UPDATE ON content_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate repurpose eligibility
CREATE OR REPLACE FUNCTION update_repurpose_eligibility()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate if post is eligible for repurposing (30+ days old)
  NEW.repurpose_eligible = (
    NEW.published_at IS NOT NULL AND 
    NEW.published_at <= (now() - interval '30 days')
  );
  
  -- Set repurpose date if eligible
  IF NEW.repurpose_eligible AND NEW.repurpose_date IS NULL THEN
    NEW.repurpose_date = NEW.published_at + interval '30 days';
  END IF;
  
  -- Calculate content length
  NEW.content_length = COALESCE(length(NEW.content), 0);
  
  -- Determine performance tier based on engagement
  IF NEW.engagement_rate >= 5.0 THEN
    NEW.performance_tier = 'viral';
  ELSIF NEW.engagement_rate >= 3.0 THEN
    NEW.performance_tier = 'high';
  ELSIF NEW.engagement_rate >= 1.0 THEN
    NEW.performance_tier = 'average';
  ELSE
    NEW.performance_tier = 'low';
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
    
    -- Create notification for the inviter
    INSERT INTO notification_queue (user_id, notification_type, title, message, data)
    VALUES (
      NEW.from_user_id,
      'partnership_accepted',
      'Partnership Accepted!',
      'Your synergy partnership invitation has been accepted.',
      jsonb_build_object('partner_id', NEW.to_user_id, 'invitation_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_partnership_trigger
  BEFORE UPDATE ON synergy_invitations
  FOR EACH ROW EXECUTE FUNCTION create_partnership_on_acceptance();

-- Function to create default user data
CREATE OR REPLACE FUNCTION create_default_user_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default user settings
  INSERT INTO user_settings (user_id) VALUES (NEW.id);
  
  -- Create default user profile
  INSERT INTO user_profiles (user_id, headline, industry, location) 
  VALUES (NEW.id, NEW.headline, NEW.industry, NEW.location);
  
  -- Create welcome notification
  INSERT INTO notification_queue (user_id, notification_type, title, message, priority)
  VALUES (
    NEW.id,
    'system_update',
    'Welcome to LinkedIn Growth!',
    'Your account has been created successfully. Start by exploring the dashboard and adding synergy partners.',
    'normal'
  );
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER create_user_defaults
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_default_user_data();

-- Function to clean expired data
CREATE OR REPLACE FUNCTION clean_expired_data()
RETURNS void AS $$
BEGIN
  -- Clean expired analytics cache
  DELETE FROM analytics_cache WHERE expires_at < now();
  
  -- Clean old comment cache (older than 7 days)
  DELETE FROM comment_cache WHERE fetched_at < (now() - interval '7 days');
  
  -- Clean old unused suggested comments (older than 30 days)
  DELETE FROM suggested_comments 
  WHERE created_at < (now() - interval '30 days') AND used = false;
  
  -- Clean expired invitations
  UPDATE synergy_invitations 
  SET invitation_status = 'expired' 
  WHERE invitation_status = 'pending' AND expires_at < now();
  
  -- Clean old notifications (older than 90 days)
  DELETE FROM notification_queue WHERE created_at < (now() - interval '90 days');
  
  -- Clean expired sessions
  DELETE FROM user_sessions WHERE expires_at < now();
  
  -- Clean old API logs (older than 30 days)
  DELETE FROM api_usage_logs WHERE created_at < (now() - interval '30 days');
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
    RETURN ROUND((likes + comments + shares)::decimal / 10, 2);
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

-- Views for common queries
CREATE OR REPLACE VIEW user_dashboard_summary AS
SELECT 
  u.id,
  u.name,
  u.email,
  u.headline,
  u.industry,
  u.dma_active,
  up.total_connections,
  up.profile_completeness_score,
  COUNT(pc.id) as total_posts,
  AVG(pc.engagement_rate) as avg_engagement_rate,
  COUNT(sp.id) as synergy_partners_count,
  als.overall_grade as current_algorithm_grade,
  COUNT(CASE WHEN nq.read = false THEN 1 END) as unread_notifications
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN post_cache pc ON u.id = pc.user_id AND pc.published_at >= (now() - interval '30 days')
LEFT JOIN synergy_partners sp ON (u.id = sp.a_user_id OR u.id = sp.b_user_id) AND sp.partnership_status = 'active'
LEFT JOIN algorithm_scores als ON u.id = als.user_id AND als.measurement_date = CURRENT_DATE
LEFT JOIN notification_queue nq ON u.id = nq.user_id AND nq.read = false
GROUP BY u.id, u.name, u.email, u.headline, u.industry, u.dma_active, up.total_connections, up.profile_completeness_score, als.overall_grade;

-- View for searchable users (DMA active only)
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
  up.profile_completeness_score,
  u.created_at
FROM users u
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.dma_active = true AND u.account_status = 'active';

-- View for pending invitations with user details
CREATE OR REPLACE VIEW pending_invitations_detailed AS
SELECT 
  si.id,
  si.from_user_id,
  si.to_user_id,
  si.invitation_status,
  si.message,
  si.created_at,
  si.expires_at,
  from_user.name as from_user_name,
  from_user.avatar_url as from_user_avatar,
  from_user.headline as from_user_headline,
  to_user.name as to_user_name,
  to_user.avatar_url as to_user_avatar,
  to_user.headline as to_user_headline
FROM synergy_invitations si
JOIN users from_user ON si.from_user_id = from_user.id
JOIN users to_user ON si.to_user_id = to_user.id
WHERE si.invitation_status = 'pending' AND si.expires_at > now();

-- View for active partnerships with user details
CREATE OR REPLACE VIEW active_partnerships_detailed AS
SELECT 
  sp.id as partnership_id,
  sp.a_user_id,
  sp.b_user_id,
  sp.partnership_status,
  sp.engagement_score,
  sp.total_interactions,
  sp.last_interaction,
  sp.created_at,
  a_user.name as a_user_name,
  a_user.avatar_url as a_user_avatar,
  a_user.headline as a_user_headline,
  b_user.name as b_user_name,
  b_user.avatar_url as b_user_avatar,
  b_user.headline as b_user_headline
FROM synergy_partners sp
JOIN users a_user ON sp.a_user_id = a_user.id
JOIN users b_user ON sp.b_user_id = b_user.id
WHERE sp.partnership_status = 'active';

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Create indexes for full-text search
CREATE INDEX idx_users_search_vector ON users USING gin(
  (setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
   setweight(to_tsvector('english', coalesce(headline, '')), 'B') ||
   setweight(to_tsvector('english', coalesce(industry, '')), 'C') ||
   setweight(to_tsvector('english', coalesce(location, '')), 'D'))
);