-- Performance optimizations based on Supabase linter recommendations

-- Optimize RLS policies to reduce multiple permissive policies
-- Consolidate request policies
DROP POLICY IF EXISTS "Volunteers can view assigned requests" ON requests;
DROP POLICY IF EXISTS "Volunteers can view available requests" ON requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON requests;
DROP POLICY IF EXISTS "Victims can view own requests" ON requests;

-- Create single comprehensive policy for requests
CREATE POLICY "requests_comprehensive_policy" ON requests
  FOR ALL
  TO dashboard_user
  USING (
    -- Admins can see all requests
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') OR
    -- Volunteers can see assigned requests and available pending requests
    (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'volunteer') AND 
     (assigned_volunteer_id = auth.uid() OR (status = 'pending' AND assigned_volunteer_id IS NULL))) OR
    -- Victims can see their own requests (authenticated)
    (victim_id = auth.uid()) OR
    -- Anonymous victims can see their requests via anonymous_victim_id
    (auth.role() = 'anon' AND anonymous_victim_id IS NOT NULL)
  )
  WITH CHECK (
    -- Admins can modify all requests
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') OR
    -- Volunteers can update assigned requests
    (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'volunteer') AND assigned_volunteer_id = auth.uid()) OR
    -- Victims can create requests
    (victim_id = auth.uid() OR auth.role() = 'anon')
  );

-- Optimize messages policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

CREATE POLICY "messages_comprehensive_policy" ON messages
  FOR ALL
  TO dashboard_user
  USING (
    -- Users can see messages where they are sender or recipient
    sender_id = auth.uid() OR 
    recipient_id = auth.uid() OR
    -- Anonymous users can see their messages
    (auth.role() = 'anon' AND (anonymous_sender_id IS NOT NULL OR anonymous_recipient_id IS NOT NULL)) OR
    -- Admins can see all messages
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    -- Users can send messages
    sender_id = auth.uid() OR 
    (auth.role() = 'anon' AND anonymous_sender_id IS NOT NULL)
  );

-- Add composite indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_requests_status_created ON requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_volunteer_status ON requests(assigned_volunteer_id, status) WHERE assigned_volunteer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_anonymous_conversation ON messages(anonymous_sender_id, anonymous_recipient_id, created_at DESC) WHERE anonymous_sender_id IS NOT NULL;

-- Add partial indexes for better performance on filtered queries
CREATE INDEX IF NOT EXISTS idx_requests_pending ON requests(created_at DESC) WHERE status = 'pending' AND assigned_volunteer_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, created_at DESC) WHERE NOT read;

-- Update table statistics for better query planning
ANALYZE requests;
ANALYZE messages;
ANALYZE notifications;
ANALYZE users;

-- Add constraints to ensure data integrity
ALTER TABLE requests ADD CONSTRAINT check_request_assignment 
  CHECK (
    (assigned_volunteer_id IS NULL AND status = 'pending') OR
    (assigned_volunteer_id IS NOT NULL AND status IN ('assigned', 'in_progress', 'completed'))
  );

-- Ensure proper foreign key constraints
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_assigned_volunteer_id_fkey;
ALTER TABLE requests ADD CONSTRAINT requests_assigned_volunteer_id_fkey 
  FOREIGN KEY (assigned_volunteer_id) REFERENCES users(id) ON DELETE SET NULL;
