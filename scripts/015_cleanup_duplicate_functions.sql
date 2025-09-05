-- Clean up duplicate database functions and create single correct version

-- Drop all existing versions of the function to avoid conflicts
DROP FUNCTION IF EXISTS public.accept_request_by_volunteer(uuid, uuid);
DROP FUNCTION IF EXISTS public.accept_request_by_volunteer(request_id_param uuid, volunteer_id_param uuid);
DROP FUNCTION IF EXISTS public.accept_request_by_volunteer(request_id_param uuid, volunteer_id_param text);

-- Create single clean version that works with current schema
CREATE OR REPLACE FUNCTION public.accept_request_by_volunteer(
  request_id_param uuid,
  volunteer_id_param text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the request with volunteer assignment
  UPDATE public.requests 
  SET 
    assigned_volunteer_id = volunteer_id_param,
    status = 'assigned',
    accepted_by_volunteer = true,
    accepted_at = NOW(),
    assigned_at = NOW()
  WHERE id = request_id_param 
    AND (assigned_volunteer_id IS NULL OR assigned_volunteer_id = '');
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Update volunteer availability in volunteers table
  UPDATE public.volunteers 
  SET 
    is_available = false,
    updated_at = NOW()
  WHERE anonymous_volunteer_id = volunteer_id_param;
  
  RETURN true;
END;
$$;

-- Also clean up complete request function if it exists
DROP FUNCTION IF EXISTS public.complete_request_by_volunteer(uuid, text);

-- Create complete request function
CREATE OR REPLACE FUNCTION public.complete_request_by_volunteer(
  request_id_param uuid,
  volunteer_id_param text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the request status to completed
  UPDATE public.requests 
  SET 
    status = 'completed',
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = request_id_param 
    AND assigned_volunteer_id = volunteer_id_param;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Make volunteer available again
  UPDATE public.volunteers 
  SET 
    is_available = true,
    updated_at = NOW()
  WHERE anonymous_volunteer_id = volunteer_id_param;
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.accept_request_by_volunteer(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_request_by_volunteer(uuid, text) TO anon, authenticated;
