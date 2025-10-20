/*
  # Complete LinkedIn Growth Platform - All Missing Tables

  1. Additional Tables for Full Platform Functionality
    - `dashboard_insights` - AI-generated dashboard insights
    - `analytics_insights` - AI analytics narratives  
    - `algo_analysis` - Algorithm analysis per user
    - `posting_strategies` - AI-generated posting strategies
    - `pdf_exports` - PDF export tracking
    - `post_repurpose_log` - Post repurpose tracking
    - `user_activity_log` - All user actions tracking

  2. Enhanced existing tables with missing fields
  3. Views for efficient data retrieval
  4. Functions for automated data processing
*/

-- Dashboard insights storage
CREATE TABLE IF NOT EXISTS dashboard_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric_type text NOT NULL CHECK (metric_type IN ('profileCompleteness', 'postingActivity', 'engagementQuality', 'contentImpact', 'contentDiversity', 'postingConsistency')),
  insight_text text NOT NULL,
  score decimal(3,1) NOT NULL,
  recommendations jsonb DEFAULT '[]'::jsonb,
  ai_model text DEFAULT 'gpt-4o-mini',
  generated_at timestamptz DEFAULT now(),
  is_current boolean DEFAULT true,
  
  CONSTRAINT unique_user_metric_current UNIQUE (user_id, metric_type, is_current)
);

-- Analytics insights storage
CREATE TABLE IF NOT EXISTS analytics_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_range text NOT NULL CHECK (time_range IN ('7d', '30d', '90d')),
  narrative_text text NOT NULL,
  key_metrics jsonb NOT NULL,
  recommendations jsonb DEFAULT '[]'::jsonb,
  ai_model text DEFAULT 'gpt-4o-mini',
  generated_at timestamptz DEFAULT now(),
  is_current boolean DEFAULT true,
  
  CONSTRAINT unique_user_analytics_current UNIQUE (user_id, time_range, is_current)
);

-- Algorithm analysis storage
CREATE TABLE IF NOT EXISTS algo_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  analysis_date date DEFAULT CURRENT_DATE,
  overall_grade text CHECK (overall_grade IN ('A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F')),
  posting_frequency_score integer CHECK (posting_frequency_score >= 0 AND posting_frequency_score <= 10),
  engagement_rate_score integer CHECK (engagement_rate_score >= 0 AND engagement_rate_score <= 10),
  reach_score integer CHECK (reach_score >= 0 AND reach_score <= 10),
  content_mix_score integer CHECK (content_mix_score >= 0 AND content_mix_score <= 10),
  consistency_score integer CHECK (consistency_score >= 0 AND consistency_score <= 10),
  ai_analysis_text text,
  recommendations jsonb DEFAULT '[]'::jsonb,
  optimization_tips jsonb DEFAULT '[]'::jsonb,
  best_posting_times jsonb DEFAULT '[]'::jsonb,
  top_performing_formats jsonb DEFAULT '[]'::jsonb,
  ai_model text DEFAULT 'gpt-4o-mini',
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_daily_analysis UNIQUE (user_id, analysis_date)
);

-- Posting strategies storage
CREATE TABLE IF NOT EXISTS posting_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  strategy_name text NOT NULL,
  industry_focus text,
  strategy_text text NOT NULL,
  optimal_schedule jsonb DEFAULT '{}'::jsonb,
  content_mix jsonb DEFAULT '{}'::jsonb,
  engagement_tactics jsonb DEFAULT '[]'::jsonb,
  hashtag_strategy jsonb DEFAULT '[]'::jsonb,
  ai_model text DEFAULT 'gpt-4o-mini',
  strategy_status text DEFAULT 'active' CHECK (strategy_status IN ('active', 'archived', 'draft')),
  usage_count integer DEFAULT 0,
  effectiveness_score decimal(3,1),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_user_strategy_name UNIQUE (user_id, strategy_name)
);

-- PDF exports tracking
CREATE TABLE IF NOT EXISTS pdf_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  export_type text NOT NULL CHECK (export_type IN ('analytics', 'dashboard', 'algo', 'full_report')),
  time_range text CHECK (time_range IN ('7d', '30d', '90d', '1y')),
  file_name text NOT NULL,
  file_size integer,
  export_data jsonb,
  generated_at timestamptz DEFAULT now(),
  download_count integer DEFAULT 0,
  last_downloaded timestamptz
);

-- Post repurpose tracking
CREATE TABLE IF NOT EXISTS post_repurpose_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_post_id uuid NOT NULL REFERENCES post_cache(id) ON DELETE CASCADE,
  repurposed_post_id uuid REFERENCES post_cache(id),
  repurpose_type text DEFAULT 'rewrite' CHECK (repurpose_type IN ('rewrite', 'update', 'remix')),
  repurpose_method text DEFAULT 'manual' CHECK (repurpose_method IN ('manual', 'ai_assisted', 'automated')),
  original_content text,
  repurposed_content text,
  performance_comparison jsonb,
  repurposed_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_original_repurpose UNIQUE (original_post_id, repurposed_at)
);

-- User activity logging
CREATE TABLE IF NOT EXISTS user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN (
    'login', 'logout', 'synergy_link_created', 'idea_generated', 'comment_suggested',
    'post_repurposed', 'strategy_created', 'pdf_exported', 'analytics_viewed',
    'dashboard_viewed', 'algo_analyzed', 'partnership_created'
  )),
  activity_description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dashboard_insights_user_current ON dashboard_insights(user_id, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_analytics_insights_user_current ON analytics_insights(user_id, time_range, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_algo_analysis_user_date ON algo_analysis(user_id, analysis_date DESC);
CREATE INDEX IF NOT EXISTS idx_posting_strategies_user_active ON posting_strategies(user_id, strategy_status) WHERE strategy_status = 'active';
CREATE INDEX IF NOT EXISTS idx_pdf_exports_user_date ON pdf_exports(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_repurpose_user_date ON post_repurpose_log(user_id, repurposed_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_date ON user_activity_log(user_id, created_at DESC);

-- Enable RLS on new tables
ALTER TABLE dashboard_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE algo_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE posting_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_repurpose_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for new tables
CREATE POLICY "Users can manage their own dashboard insights" ON dashboard_insights FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage their own analytics insights" ON analytics_insights FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage their own algo analysis" ON algo_analysis FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage their own posting strategies" ON posting_strategies FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage their own PDF exports" ON pdf_exports FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can manage their own repurpose log" ON post_repurpose_log FOR ALL TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can read their own activity log" ON user_activity_log FOR SELECT TO authenticated USING (auth.uid()::text = user_id::text);
CREATE POLICY "System can log user activity" ON user_activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- Function to log user activity
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id uuid,
  p_activity_type text,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_activity_log (user_id, activity_type, activity_description, metadata)
  VALUES (p_user_id, p_activity_type, p_description, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark old insights as not current
CREATE OR REPLACE FUNCTION mark_old_insights_inactive()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark old dashboard insights as not current
  IF TG_TABLE_NAME = 'dashboard_insights' THEN
    UPDATE dashboard_insights 
    SET is_current = false 
    WHERE user_id = NEW.user_id 
      AND metric_type = NEW.metric_type 
      AND id != NEW.id;
  END IF;
  
  -- Mark old analytics insights as not current
  IF TG_TABLE_NAME = 'analytics_insights' THEN
    UPDATE analytics_insights 
    SET is_current = false 
    WHERE user_id = NEW.user_id 
      AND time_range = NEW.time_range 
      AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for insight management
CREATE TRIGGER dashboard_insights_current_trigger
  AFTER INSERT ON dashboard_insights
  FOR EACH ROW EXECUTE FUNCTION mark_old_insights_inactive();

CREATE TRIGGER analytics_insights_current_trigger
  AFTER INSERT ON analytics_insights
  FOR EACH ROW EXECUTE FUNCTION mark_old_insights_inactive();

-- Enhanced views for efficient data retrieval
CREATE OR REPLACE VIEW user_synergy_overview AS
SELECT 
  u.id as user_id,
  u.name,
  u.email,
  u.avatar_url,
  u.headline,
  u.industry,
  u.dma_active,
  COUNT(DISTINCT sp.id) as total_partnerships,
  COUNT(DISTINCT si_sent.id) as invitations_sent,
  COUNT(DISTINCT si_received.id) as invitations_received,
  COUNT(DISTINCT sc.id) as suggestions_given,
  COUNT(DISTINCT pc.id) as posts_cached
FROM users u
LEFT JOIN synergy_partners sp ON (u.id = sp.a_user_id OR u.id = sp.b_user_id)
LEFT JOIN synergy_invitations si_sent ON u.id = si_sent.from_user_id
LEFT JOIN synergy_invitations si_received ON u.id = si_received.to_user_id
LEFT JOIN suggested_comments sc ON u.id = sc.from_user_id
LEFT JOIN post_cache pc ON u.id = pc.user_id
WHERE u.dma_active = true
GROUP BY u.id, u.name, u.email, u.avatar_url, u.headline, u.industry, u.dma_active;

-- View for repurpose-ready posts
CREATE OR REPLACE VIEW repurpose_ready_posts AS
SELECT 
  pc.*,
  CASE 
    WHEN pc.published_at <= (now() - interval '30 days') THEN 'ready'
    WHEN pc.published_at <= (now() - interval '25 days') THEN 'soon'
    ELSE 'too_recent'
  END as repurpose_status,
  EXTRACT(days FROM (now() - pc.published_at)) as days_since_published,
  prl.repurposed_at as last_repurposed
FROM post_cache pc
LEFT JOIN post_repurpose_log prl ON pc.id = prl.original_post_id
ORDER BY 
  CASE 
    WHEN pc.published_at <= (now() - interval '30 days') THEN 1
    WHEN pc.published_at <= (now() - interval '25 days') THEN 2
    ELSE 3
  END,
  pc.published_at DESC;

-- Grant permissions
GRANT ALL ON dashboard_insights TO authenticated;
GRANT ALL ON analytics_insights TO authenticated;
GRANT ALL ON algo_analysis TO authenticated;
GRANT ALL ON posting_strategies TO authenticated;
GRANT ALL ON pdf_exports TO authenticated;
GRANT ALL ON post_repurpose_log TO authenticated;
GRANT ALL ON user_activity_log TO authenticated;
GRANT EXECUTE ON FUNCTION log_user_activity TO authenticated;