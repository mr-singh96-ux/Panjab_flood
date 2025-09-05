-- Function to send notification when volunteer is assigned
CREATE OR REPLACE FUNCTION public.notify_volunteer_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Send message to victim that team is dispatched
  IF NEW.assigned_volunteer_id IS NOT NULL AND OLD.assigned_volunteer_id IS NULL THEN
    -- Handle both authenticated and anonymous victims
    IF NEW.victim_id IS NOT NULL THEN
      INSERT INTO public.messages (sender_id, recipient_id, request_id, message_type, title, content)
      VALUES (
        NULL, -- system message
        NEW.victim_id,
        NEW.id,
        'assignment',
        'Help Team Dispatched',
        'A volunteer team has been assigned to your request: ' || NEW.title || '. They will be in contact soon.'
      );
    ELSIF NEW.anonymous_victim_id IS NOT NULL THEN
      INSERT INTO public.messages (sender_id, anonymous_recipient_id, request_id, message_type, title, content)
      VALUES (
        NULL, -- system message
        NEW.anonymous_victim_id,
        NEW.id,
        'assignment',
        'Help Team Dispatched',
        'A volunteer team has been assigned to your request: ' || NEW.title || '. Contact: ' || COALESCE(NEW.contact_info, 'Emergency Services')
      );
    END IF;
    
    -- Send message to volunteer about assignment
    INSERT INTO public.messages (sender_id, recipient_id, request_id, message_type, title, content)
    VALUES (
      NULL, -- system message
      NEW.assigned_volunteer_id,
      NEW.id,
      'assignment',
      'New Assignment',
      'You have been assigned to help with: ' || NEW.title || '. Location: ' || NEW.location || '. Contact: ' || COALESCE(NEW.contact_info, 'Check request details')
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to send notification when request is completed
CREATE OR REPLACE FUNCTION public.notify_request_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Send message to admin when mission is accomplished
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Find all admins and notify them
    INSERT INTO public.messages (sender_id, recipient_id, request_id, message_type, title, content)
    SELECT 
      NEW.assigned_volunteer_id,
      u.id,
      NEW.id,
      'completion',
      'Mission Accomplished',
      'Request "' || NEW.title || '" has been completed successfully. Location: ' || NEW.location
    FROM public.users u
    WHERE u.role = 'admin';
    
    -- Send confirmation to victim (handle both authenticated and anonymous)
    IF NEW.victim_id IS NOT NULL THEN
      INSERT INTO public.messages (sender_id, recipient_id, request_id, message_type, title, content)
      VALUES (
        NEW.assigned_volunteer_id,
        NEW.victim_id,
        NEW.id,
        'completion',
        'Request Completed',
        'Your request "' || NEW.title || '" has been completed. Thank you for your patience.'
      );
    ELSIF NEW.anonymous_victim_id IS NOT NULL THEN
      INSERT INTO public.messages (sender_id, anonymous_recipient_id, request_id, message_type, title, content)
      VALUES (
        NEW.assigned_volunteer_id,
        NEW.anonymous_victim_id,
        NEW.id,
        'completion',
        'Request Completed',
        'Your request "' || NEW.title || '" has been completed. Thank you for your patience.'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Triggers for notifications
DROP TRIGGER IF EXISTS on_volunteer_assigned ON public.requests;
CREATE TRIGGER on_volunteer_assigned
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_volunteer_assigned();

DROP TRIGGER IF EXISTS on_request_completed ON public.requests;
CREATE TRIGGER on_request_completed
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_request_completed();
