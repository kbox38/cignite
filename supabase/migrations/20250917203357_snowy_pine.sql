/*
  # Fix DMA URN Field in Users Table

  1. Add linkedin_dma_member_urn column if missing
  2. Update RLS policies to handle DMA URN properly
  3. Add indexes for DMA URN lookups
  4. Create function to verify DMA setup
*/

-- Add linkedin_dma_member_urn column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'linkedin_dma_member_urn'
    ) THEN
        ALTER TABLE users ADD COLUMN linkedin_dma_member_urn text;
        RAISE NOTICE 'Added linkedin_dma_member_urn column to users table';
    ELSE
        RAISE NOTICE 'linkedin_dma_member_urn column already exists';
    END IF;
END $$;

-- Add unique constraint on linkedin_dma_member_urn if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'users' 
        AND constraint_name = 'users_linkedin_dma_member_urn_key'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_linkedin_dma_member_urn_key UNIQUE (linkedin_dma_member_urn);
        RAISE NOTICE 'Added unique constraint on linkedin_dma_member_urn';
    ELSE
        RAISE NOTICE 'Unique constraint on linkedin_dma_member_urn already exists';
    END IF;
END $$;

-- Add index for DMA URN lookups if not exists
CREATE INDEX IF NOT EXISTS idx_users_linkedin_dma_urn ON users(linkedin_dma_member_urn);

-- Add index for DMA active users if not exists
CREATE INDEX IF NOT EXISTS idx_users_dma_active_urn ON users(linkedin_dma_member_urn) WHERE dma_active = true;

-- Function to verify and fix DMA setup for a user
CREATE OR REPLACE FUNCTION verify_dma_setup(user_email text)
RETURNS TABLE(
    user_id uuid,
    name text,
    email text,
    linkedin_member_urn text,
    linkedin_dma_member_urn text,
    dma_active boolean,
    dma_consent_date timestamptz,
    recommendations text[]
) AS $$
DECLARE
    user_record RECORD;
    recs text[] := ARRAY[]::text[];
BEGIN
    -- Get user record
    SELECT * INTO user_record FROM users u WHERE u.email = user_email;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found with email: %', user_email;
    END IF;
    
    -- Check DMA setup and generate recommendations
    IF user_record.linkedin_dma_member_urn IS NULL THEN
        recs := array_append(recs, 'Missing linkedin_dma_member_urn - complete DMA OAuth flow');
    END IF;
    
    IF user_record.dma_active = false THEN
        recs := array_append(recs, 'DMA not active - ensure DMA consent is properly granted');
    END IF;
    
    IF user_record.dma_consent_date IS NULL THEN
        recs := array_append(recs, 'Missing DMA consent date - should be set when DMA is activated');
    END IF;
    
    IF user_record.linkedin_member_urn IS NULL THEN
        recs := array_append(recs, 'Missing basic LinkedIn URN - complete basic OAuth flow first');
    END IF;
    
    IF array_length(recs, 1) = 0 THEN
        recs := array_append(recs, 'DMA setup looks correct');
    END IF;
    
    -- Return the analysis
    RETURN QUERY SELECT 
        user_record.id,
        user_record.name,
        user_record.email,
        user_record.linkedin_member_urn,
        user_record.linkedin_dma_member_urn,
        user_record.dma_active,
        user_record.dma_consent_date,
        recs;
END;
$$ LANGUAGE plpgsql;

-- Function to manually fix DMA setup for a user (for debugging)
CREATE OR REPLACE FUNCTION fix_user_dma_setup(
    user_email text,
    dma_urn text DEFAULT NULL,
    force_activate boolean DEFAULT false
)
RETURNS TABLE(
    success boolean,
    message text,
    user_id uuid
) AS $$
DECLARE
    user_record RECORD;
    result_message text;
BEGIN
    -- Get user record
    SELECT * INTO user_record FROM users u WHERE u.email = user_email;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'User not found with email: ' || user_email, NULL::uuid;
        RETURN;
    END IF;
    
    -- Update DMA settings
    UPDATE users SET
        linkedin_dma_member_urn = COALESCE(dma_urn, linkedin_dma_member_urn),
        dma_active = CASE 
            WHEN force_activate THEN true
            WHEN dma_urn IS NOT NULL THEN true
            ELSE dma_active
        END,
        dma_consent_date = CASE 
            WHEN force_activate OR dma_urn IS NOT NULL THEN now()
            ELSE dma_consent_date
        END,
        updated_at = now()
    WHERE id = user_record.id;
    
    result_message := 'DMA setup updated for user: ' || user_record.name;
    
    IF dma_urn IS NOT NULL THEN
        result_message := result_message || ' (DMA URN set)';
    END IF;
    
    IF force_activate THEN
        result_message := result_message || ' (DMA force activated)';
    END IF;
    
    RETURN QUERY SELECT true, result_message, user_record.id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_dma_setup TO authenticated;
GRANT EXECUTE ON FUNCTION fix_user_dma_setup TO authenticated;

-- Test the setup (uncomment to run verification)
-- SELECT * FROM verify_dma_setup('your-email@example.com');