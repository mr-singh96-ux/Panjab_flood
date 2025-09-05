-- Add fields to track how requests were assigned and by whom
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS accepted_by_volunteer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS assignment_method TEXT DEFAULT 'admin_assigned', -- 'self_accepted' or 'admin_assigned'
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- Update existing assigned requests to have proper assignment method
UPDATE public.requests 
SET assignment_method = 'admin_assigned', 
    accepted_by_volunteer = FALSE 
WHERE assigned_volunteer_id IS NOT NULL AND assignment_method IS NULL;

-- Add index for better performance on assignment queries
CREATE INDEX IF NOT EXISTS idx_requests_assignment_method ON public.requests(assignment_method);
CREATE INDEX IF NOT EXISTS idx_requests_accepted_by_volunteer ON public.requests(accepted_by_volunteer);

-- Create function to handle volunteer self-acceptance with race condition protection
CREATE OR REPLACE FUNCTION accept_request_by_volunteer(
  request_id_param UUID,
  volunteer_id_param UUID
) RETURNS JSONB AS $$
DECLARE
  request_record RECORD;
  result JSONB;
BEGIN
  -- Lock the request row to prevent race conditions
  SELECT * INTO request_record 
  FROM public.requests 
  WHERE id = request_id_param 
  FOR UPDATE;
  
  -- Check if request exists and is still available
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;
  
  -- Check if request is already assigned
  IF request_record.assigned_volunteer_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request already assigned');
  END IF;
  
  -- Check if request is still pending
  IF request_record.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is no longer pending');
  END IF;
  
  -- Assign the request to the volunteer
  UPDATE public.requests 
  SET 
    assigned_volunteer_id = volunteer_id_param,
    status = 'assigned',
    assigned_at = NOW(),
    accepted_at = NOW(),
    accepted_by_volunteer = TRUE,
    assignment_method = 'self_accepted',
    updated_at = NOW()
  WHERE id = request_id_param;
  
  -- Mark volunteer as unavailable
  UPDATE public.users 
  SET is_available = FALSE, updated_at = NOW()
  WHERE id = volunteer_id_param;
  
  RETURN jsonb_build_object('success', true, 'message', 'Request accepted successfully');
END;
$$ LANGUAGE plpgsql;
