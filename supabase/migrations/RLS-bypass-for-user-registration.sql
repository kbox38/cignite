-- First, re-enable RLS if not already done
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can insert own data" ON users;
DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;

-- Create new policies for users table
-- Allow service role to create and manage users (for registration)
CREATE POLICY "Service role can create users" 
  ON users 
  FOR INSERT 
  TO service_role 
  WITH CHECK (true);

CREATE POLICY "Service role can update users" 
  ON users 
  FOR UPDATE 
  TO service_role 
  USING (true);

CREATE POLICY "Service role can read users" 
  ON users 
  FOR SELECT 
  TO service_role 
  USING (true);

-- Allow authenticated users to manage their own data
CREATE POLICY "Authenticated users can read own data" 
  ON users 
  FOR SELECT 
  TO authenticated 
  USING (auth.uid()::text = id::text);

CREATE POLICY "Authenticated users can update own data" 
  ON users 
  FOR UPDATE 
  TO authenticated 
  USING (auth.uid()::text = id::text);

-- Keep the existing policy for searching other DMA users
-- (This should already exist, but recreate if needed)
DROP POLICY IF EXISTS "Users can search other DMA users" ON users;
CREATE POLICY "Users can search other DMA users" 
  ON users 
  FOR SELECT 
  TO authenticated 
  USING (dma_active = true);

-- Create new policies for user_profiles table
-- Allow service role full access (for profile creation during registration)
CREATE POLICY "Service role can manage all profiles" 
  ON user_profiles 
  FOR ALL 
  TO service_role 
  USING (true);

-- Allow authenticated users to manage their own profiles
CREATE POLICY "Authenticated users can manage own profile" 
  ON user_profiles 
  FOR ALL 
  TO authenticated 
  USING (auth.uid()::text = user_id::text);

-- Allow partners to read each other's profiles (keep existing functionality)
DROP POLICY IF EXISTS "Partners can read each other's profiles" ON user_profiles;
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

-- Verify the policies are working
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('users', 'user_profiles') 
ORDER BY tablename, policyname;