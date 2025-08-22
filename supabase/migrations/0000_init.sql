--
-- Cignite - Master Database Schema
-- Version: 1.0
-- Author: SaaS Architect Pro
--

-- 1. extensions
-- Enable necessary PostgreSQL extensions for enhanced functionality.
--
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "btree_gin" WITH SCHEMA extensions;


-- 2. types
-- Define custom ENUM types for consistent and constrained values across the schema.
--
CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE public.subscription_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'declined', 'cancelled', 'expired');
CREATE TYPE public.partnership_status AS ENUM ('active', 'paused', 'ended');
CREATE TYPE public.media_type AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'ARTICLE', 'CAROUSEL', 'POLL', 'DOCUMENT');
CREATE TYPE public.notification_type AS ENUM ('invitation', 'partnership_accepted', 'comment_suggestion', 'analytics_ready', 'system_update');


-- 3. tables
-- Define the core tables of the application.
--
CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    name text,
    avatar_url text,
    headline text,
    linkedin_member_urn text UNIQUE,
    dma_active boolean DEFAULT false NOT NULL,
    account_status public.account_status DEFAULT 'active' NOT NULL,
    subscription_tier public.subscription_tier DEFAULT 'free' NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.synergy_partners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    a_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    b_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status public.partnership_status DEFAULT 'active' NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT unique_partnership UNIQUE (a_user_id, b_user_id),
    CONSTRAINT no_self_partnership CHECK (a_user_id <> b_user_id)
);

CREATE TABLE public.post_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_urn text NOT NULL,
    text_preview text,
    media_type public.media_type,
    permalink text,
    raw jsonb,
    created_at_ms bigint NOT NULL,
    fetched_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT unique_user_post UNIQUE (owner_user_id, post_urn)
);

CREATE TABLE public.comment_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    object_urn text NOT NULL,
    message text,
    raw jsonb,
    created_at_ms bigint NOT NULL,
    fetched_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.suggested_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    to_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_urn text NOT NULL,
    suggestion text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);


-- 4. indexes
-- Create indexes to optimize query performance.
--
CREATE INDEX idx_users_linkedin_urn ON public.users(linkedin_member_urn);
CREATE INDEX idx_users_dma_active ON public.users(dma_active) WHERE dma_active = true;
CREATE INDEX idx_users_email_trgm ON public.users USING gin(email extensions.gin_trgm_ops);
CREATE INDEX idx_users_name_trgm ON public.users USING gin(name extensions.gin_trgm_ops);
CREATE INDEX idx_synergy_partners_a_user ON public.synergy_partners(a_user_id);
CREATE INDEX idx_synergy_partners_b_user ON public.synergy_partners(b_user_id);
CREATE INDEX idx_post_cache_owner_created ON public.post_cache(owner_user_id, created_at_ms DESC);
CREATE INDEX idx_comment_cache_author_created ON public.comment_cache(author_user_id, created_at_ms DESC);
CREATE INDEX idx_comment_cache_object_author ON public.comment_cache(object_urn, author_user_id);
CREATE INDEX idx_suggested_comments_lookup ON public.suggested_comments(from_user_id, to_user_id, post_urn);


-- 5. functions
-- Define helper functions for triggers and other database logic.
--
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';


-- 6. triggers
-- Create triggers to automate database actions.
--
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();


-- 7. rls policies
-- Enable Row Level Security and define access policies for each table.
--
-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own data" ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update their own data" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can search other DMA-active users" ON public.users FOR SELECT TO authenticated USING (dma_active = true);

-- synergy_partners
ALTER TABLE public.synergy_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own partnerships" ON public.synergy_partners FOR ALL TO authenticated USING (auth.uid() = a_user_id OR auth.uid() = b_user_id);

-- post_cache
ALTER TABLE public.post_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own cached posts" ON public.post_cache FOR ALL TO authenticated USING (auth.uid() = owner_user_id);
CREATE POLICY "Partners can read each other's cached posts" ON public.post_cache FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.synergy_partners sp
        WHERE
            (sp.a_user_id = auth.uid() AND sp.b_user_id = owner_user_id) OR
            (sp.b_user_id = auth.uid() AND sp.a_user_id = owner_user_id)
    )
);

-- comment_cache
ALTER TABLE public.comment_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own cached comments" ON public.comment_cache FOR ALL TO authenticated USING (auth.uid() = author_user_id);
CREATE POLICY "Partners can read each other's cached comments" ON public.comment_cache FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM public.synergy_partners sp
        WHERE
            (sp.a_user_id = auth.uid() AND sp.b_user_id = author_user_id) OR
            (sp.b_user_id = auth.uid() AND sp.a_user_id = author_user_id)
    )
);

-- suggested_comments
ALTER TABLE public.suggested_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage suggestions they are involved in" ON public.suggested_comments FOR ALL TO authenticated USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);