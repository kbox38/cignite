-- Fix Partnership Counter: Add total_partnerships column and auto-update triggers newly aded migration

-- 1. Add total_partnerships column to users table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'total_partnerships'
    ) THEN
        ALTER TABLE users ADD COLUMN total_partnerships integer DEFAULT 0;
    END IF;
END $$;

-- 2. Create function to update partnership counts
CREATE OR REPLACE FUNCTION update_partnership_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update count for both users involved in the partnership
    IF TG_OP = 'INSERT' THEN
        -- Increment partnership count for both users
        UPDATE users 
        SET total_partnerships = (
            SELECT COUNT(*)
            FROM synergy_partners sp
            WHERE (sp.a_user_id = users.id OR sp.b_user_id = users.id)
            AND sp.partnership_status = 'active'
        )
        WHERE id = NEW.a_user_id OR id = NEW.b_user_id;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Update count when status changes
        UPDATE users 
        SET total_partnerships = (
            SELECT COUNT(*)
            FROM synergy_partners sp
            WHERE (sp.a_user_id = users.id OR sp.b_user_id = users.id)
            AND sp.partnership_status = 'active'
        )
        WHERE id = NEW.a_user_id OR id = NEW.b_user_id;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement partnership count for both users
        UPDATE users 
        SET total_partnerships = (
            SELECT COUNT(*)
            FROM synergy_partners sp
            WHERE (sp.a_user_id = users.id OR sp.b_user_id = users.id)
            AND sp.partnership_status = 'active'
        )
        WHERE id = OLD.a_user_id OR id = OLD.b_user_id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger to automatically update partnership counts
DROP TRIGGER IF EXISTS update_partnership_counts_trigger ON synergy_partners;
CREATE TRIGGER update_partnership_counts_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON synergy_partners
    FOR EACH ROW
    EXECUTE FUNCTION update_partnership_counts();

-- 4. Enhanced function to create partnership when invitation is accepted
CREATE OR REPLACE FUNCTION create_partnership_on_acceptance()
RETURNS TRIGGER AS $$
BEGIN
    -- Only proceed if invitation status changed to 'accepted'
    IF OLD.invitation_status != 'accepted' AND NEW.invitation_status = 'accepted' THEN
        -- Create partnership entry with proper user ordering (smaller ID first)
        INSERT INTO synergy_partners (
            a_user_id,
            b_user_id,
            partnership_status,
            created_at,
            last_interaction
        )
        VALUES (
            LEAST(NEW.from_user_id, NEW.to_user_id),
            GREATEST(NEW.from_user_id, NEW.to_user_id),
            'active',
            now(),
            now()
        )
        ON CONFLICT (a_user_id, b_user_id) 
        DO UPDATE SET 
            partnership_status = 'active',
            last_interaction = now();
        
        -- Set responded_at timestamp
        NEW.responded_at = now();
        
        -- Log partnership creation
        RAISE NOTICE 'Partnership created between users % and %', NEW.from_user_id, NEW.to_user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Update trigger for partnership creation
DROP TRIGGER IF EXISTS create_partnership_trigger ON synergy_invitations;
CREATE TRIGGER create_partnership_trigger
    BEFORE UPDATE ON synergy_invitations
    FOR EACH ROW
    EXECUTE FUNCTION create_partnership_on_acceptance();

-- 6. Function to recalculate all partnership counts (for data repair)
CREATE OR REPLACE FUNCTION recalculate_all_partnership_counts()
RETURNS void AS $$
BEGIN
    -- Update all users' partnership counts based on active partnerships
    UPDATE users 
    SET total_partnerships = partnership_counts.count
    FROM (
        SELECT 
            u.id as user_id,
            COUNT(sp.id) as count
        FROM users u
        LEFT JOIN synergy_partners sp ON (sp.a_user_id = u.id OR sp.b_user_id = u.id)
            AND sp.partnership_status = 'active'
        GROUP BY u.id
    ) partnership_counts
    WHERE users.id = partnership_counts.user_id;
    
    RAISE NOTICE 'Recalculated partnership counts for all users';
END;
$$ LANGUAGE plpgsql;

-- 7. Initial count calculation for existing data
SELECT recalculate_all_partnership_counts();

-- 8. Create index for better performance
CREATE INDEX IF NOT EXISTS idx_synergy_partners_status 
ON synergy_partners(partnership_status) 
WHERE partnership_status = 'active';

CREATE INDEX IF NOT EXISTS idx_synergy_partners_users 
ON synergy_partners(a_user_id, b_user_id, partnership_status);

-- 9. Add constraint to ensure partnership_status exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'synergy_partners_partnership_status_check'
    ) THEN
        ALTER TABLE synergy_partners 
        ADD CONSTRAINT synergy_partners_partnership_status_check 
        CHECK (partnership_status IN ('pending', 'active', 'paused', 'ended'));
    END IF;
END $$;

-- 10. Update any NULL partnership_status to 'active'
UPDATE synergy_partners 
SET partnership_status = 'active' 
WHERE partnership_status IS NULL;

-- Verification query to check partnership counts
-- Run this to verify the fix is working:
/*
SELECT 
    u.id,
    u.name,
    u.total_partnerships,
    COUNT(sp.id) as actual_partnerships
FROM users u
LEFT JOIN synergy_partners sp ON (sp.a_user_id = u.id OR sp.b_user_id = u.id)
    AND sp.partnership_status = 'active'
GROUP BY u.id, u.name, u.total_partnerships
HAVING u.total_partnerships != COUNT(sp.id)
ORDER BY u.name;
*/