-- Add anonymous_id column to users table for emergency anonymous access
ALTER TABLE users ADD COLUMN IF NOT EXISTS anonymous_id text;

-- Create index for anonymous_id lookups
CREATE INDEX IF NOT EXISTS idx_users_anonymous_id ON users(anonymous_id);

-- Update RLS policies to allow anonymous access for emergency situations
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Anyone can view requests" ON requests;
DROP POLICY IF EXISTS "Users can create requests" ON requests;
DROP POLICY IF EXISTS "Users can update own requests" ON requests;
DROP POLICY IF EXISTS "Anyone can view messages" ON messages;
DROP POLICY IF EXISTS "Users can create messages" ON messages;
DROP POLICY IF EXISTS "Users can update own messages" ON messages;

-- Create new RLS policies for anonymous emergency access
CREATE POLICY "Allow anonymous access to users" ON users
    FOR ALL USING (true);

CREATE POLICY "Allow anonymous access to requests" ON requests
    FOR ALL USING (true);

CREATE POLICY "Allow anonymous access to messages" ON messages
    FOR ALL USING (true);

CREATE POLICY "Allow anonymous access to offline_sync" ON offline_sync
    FOR ALL USING (true);

-- Insert sample anonymous users for testing
INSERT INTO users (id, anonymous_id, full_name, role, location, is_available, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'anon_victim_001', 'Emergency Victim 1', 'victim', 'Flood Zone A', true, now(), now()),
    (gen_random_uuid(), 'anon_volunteer_001', 'Emergency Volunteer 1', 'volunteer', 'Relief Center B', true, now(), now()),
    (gen_random_uuid(), 'anon_admin_001', 'Emergency Coordinator', 'admin', 'Command Center', true, now(), now())
ON CONFLICT DO NOTHING;
