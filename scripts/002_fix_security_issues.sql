-- Fix security issues identified by Supabase linter

-- Fix function search path mutable issues
-- Set search_path for all functions to prevent security vulnerabilities

-- Fix accept_request_by_volunteer function
CREATE OR REPLACE FUNCTION public.accept_request_by_volunteer(
  request_id_param UUID,
  volunteer_id_param UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  request_record RECORD;
BEGIN
  -- Lock the request to prevent race conditions
  SELECT * INTO request_record 
  FROM requests 
  WHERE id = request_id_param 
  FOR UPDATE;
  
  -- Check if request exists and is available
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;
  
  -- Check if request is already assigned
  IF request_record.assigned_volunteer_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request already assigned');
  END IF;
  
  -- Update request with volunteer assignment
  UPDATE requests 
  SET 
    assigned_volunteer_id = volunteer_id_param,
    status = 'assigned',
    accepted_by_volunteer = true,
    accepted_at = NOW(),
    updated_at = NOW()
  WHERE id = request_id_param;
  
  -- Create notification for admin
  INSERT INTO notifications (
    id,
    user_id,
    type,
    title,
    message,
    created_at
  )
  SELECT 
    gen_random_uuid(),
    u.id,
    'request_accepted',
    'Request Accepted by Volunteer',
    'Request #' || request_record.id || ' has been accepted by a volunteer',
    NOW()
  FROM users u 
  WHERE u.role = 'admin';
  
  RETURN json_build_object('success', true, 'message', 'Request accepted successfully');
END;
$$;

-- Fix assign_request_to_volunteer function
CREATE OR REPLACE FUNCTION public.assign_request_to_volunteer(
  request_id_param UUID,
  volunteer_id_param UUID,
  admin_id_param UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  request_record RECORD;
BEGIN
  -- Verify admin permissions
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = admin_id_param AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Lock and get request
  SELECT * INTO request_record 
  FROM requests 
  WHERE id = request_id_param 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;
  
  -- Update request
  UPDATE requests 
  SET 
    assigned_volunteer_id = volunteer_id_param,
    status = 'assigned',
    accepted_by_volunteer = false,
    assigned_by_admin = admin_id_param,
    assigned_at = NOW(),
    updated_at = NOW()
  WHERE id = request_id_param;
  
  -- Notify volunteer
  INSERT INTO notifications (
    id,
    user_id,
    type,
    title,
    message,
    created_at
  ) VALUES (
    gen_random_uuid(),
    volunteer_id_param,
    'request_assigned',
    'New Request Assigned',
    'You have been assigned to request #' || request_record.id,
    NOW()
  );
  
  RETURN json_build_object('success', true, 'message', 'Request assigned successfully');
END;
$$;

-- Fix get_admin_stats function
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stats JSON;
BEGIN
  SELECT json_build_object(
    'total_requests', (SELECT COUNT(*) FROM requests),
    'pending_requests', (SELECT COUNT(*) FROM requests WHERE status = 'pending'),
    'assigned_requests', (SELECT COUNT(*) FROM requests WHERE status = 'assigned'),
    'completed_requests', (SELECT COUNT(*) FROM requests WHERE status = 'completed'),
    'total_volunteers', (SELECT COUNT(*) FROM users WHERE role = 'volunteer'),
    'active_volunteers', (SELECT COUNT(DISTINCT assigned_volunteer_id) FROM requests WHERE status = 'assigned'),
    'total_victims', (SELECT COUNT(*) FROM users WHERE role = 'victim')
  ) INTO stats;
  
  RETURN stats;
END;
$$;

-- Add proper RLS policies with single permissive policy per role/action
-- Drop existing conflicting policies first
DROP POLICY IF EXISTS "Allow anonymous access to users" ON users;
DROP POLICY IF EXISTS "Users can update profiles" ON users;

-- Create single comprehensive policy for users table
CREATE POLICY "users_comprehensive_policy" ON users
  FOR ALL
  TO dashboard_user
  USING (
    -- Allow access to own profile or if user is admin
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') OR
    -- Allow anonymous access for emergency coordination
    auth.role() = 'anon'
  )
  WITH CHECK (
    -- Allow updates to own profile or if user is admin
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Ensure proper indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_volunteer ON requests(assigned_volunteer_id) WHERE assigned_volunteer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_anonymous_victim ON requests(anonymous_victim_id) WHERE anonymous_victim_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE NOT read;

-- Remove unused indexes
DROP INDEX IF EXISTS idx_requests_accepted_by_volunteer;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION accept_request_by_volunteer TO dashboard_user;
GRANT EXECUTE ON FUNCTION assign_request_to_volunteer TO dashboard_user;
GRANT EXECUTE ON FUNCTION get_admin_stats TO dashboard_user;
