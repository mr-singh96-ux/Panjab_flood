-- Function to get admin dashboard statistics
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE (
  total_requests INTEGER,
  pending_requests INTEGER,
  active_requests INTEGER,
  completed_requests INTEGER,
  total_volunteers INTEGER,
  available_volunteers INTEGER,
  critical_requests INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM public.requests) as total_requests,
    (SELECT COUNT(*)::INTEGER FROM public.requests WHERE status = 'pending') as pending_requests,
    (SELECT COUNT(*)::INTEGER FROM public.requests WHERE status IN ('assigned', 'in_progress')) as active_requests,
    (SELECT COUNT(*)::INTEGER FROM public.requests WHERE status = 'completed') as completed_requests,
    (SELECT COUNT(*)::INTEGER FROM public.users WHERE role = 'volunteer') as total_volunteers,
    (SELECT COUNT(*)::INTEGER FROM public.users WHERE role = 'volunteer' AND is_available = true) as available_volunteers,
    (SELECT COUNT(*)::INTEGER FROM public.requests WHERE priority = 'critical' AND status != 'completed') as critical_requests;
END;
$$;
