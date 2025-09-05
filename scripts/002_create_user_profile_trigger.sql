-- Modified to handle both authenticated and anonymous users
-- Function to handle new user registration (for authenticated users only)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, auth_user_id, email, full_name, role)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Unknown User'),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::user_role, 'victim')
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger to automatically create user profile on signup (optional for anonymous system)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Added function to create anonymous users
-- Function to create anonymous user profiles
CREATE OR REPLACE FUNCTION public.create_anonymous_user(
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_role user_role DEFAULT 'victim',
  p_location TEXT DEFAULT NULL,
  p_anonymous_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id UUID;
BEGIN
  INSERT INTO public.users (full_name, phone, role, location, anonymous_id)
  VALUES (p_full_name, p_phone, p_role, p_location, COALESCE(p_anonymous_id, gen_random_uuid()::text))
  RETURNING id INTO new_user_id;
  
  RETURN new_user_id;
END;
$$;
