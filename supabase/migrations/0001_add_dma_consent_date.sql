-- Migration: Add DMA consent date column to users table
-- File: supabase/migrations/0001_add_dma_consent_date.sql
-- Created: 2025-08-25

-- Add dma_consent_date column to users table
ALTER TABLE public.users 
ADD COLUMN dma_consent_date timestamptz;

-- Add comment for documentation
COMMENT ON COLUMN public.users.dma_consent_date IS 'Timestamp when user gave DMA (Data Member Access) consent for LinkedIn data portability';

-- Create index for efficient querying of DMA consent dates
CREATE INDEX idx_users_dma_consent_date ON public.users(dma_consent_date) WHERE dma_consent_date IS NOT NULL;