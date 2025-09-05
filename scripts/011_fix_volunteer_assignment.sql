-- Fix volunteer assignment by removing foreign key constraint and creating proper function

-- First, drop the existing foreign key constraint on assigned_volunteer_id
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_assigned_volunteer_id_fkey;

-- Make assigned_volunteer_id a regular text field to allow anonymous volunteer IDs
ALTER TABLE requests ALTER COLUMN assigned_volunteer_id TYPE TEXT;

-- Create or replace the accept_request_by_volunteer function
CREATE OR REPLACE FUNCTION accept_request_by_volunteer(
  request_id_param UUID,
  volunteer_id_param TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_record RECORD;
  result JSON;
BEGIN
  -- Check if request exists and is available
  SELECT * INTO request_record
  FROM requests
  WHERE id = request_id_param
    AND status = 'pending'
    AND assigned_volunteer_id IS NULL;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Request not found or already assigned'
    );
  END IF;

  -- Update the request with volunteer assignment
  UPDATE requests
  SET 
    assigned_volunteer_id = volunteer_id_param,
    status = 'assigned',
    assigned_at = NOW(),
    assignment_method = 'self_assigned'
  WHERE id = request_id_param;

  -- Update volunteer availability in volunteers table
  UPDATE volunteers
  SET is_available = false
  WHERE anonymous_volunteer_id = volunteer_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Request accepted successfully'
  );
END;
$$;

-- Create index for better performance on assigned_volunteer_id queries
CREATE INDEX IF NOT EXISTS idx_requests_assigned_volunteer_id ON requests(assigned_volunteer_id);

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION accept_request_by_volunteer TO authenticated, anon;

-- Wrapped RAISE NOTICE in DO block to fix syntax error
DO $$
BEGIN
  RAISE NOTICE 'Volunteer assignment system fixed successfully';
END $$;
