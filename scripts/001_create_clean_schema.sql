-- Clean database schema for flood victim coordination system
-- Drop existing tables to start fresh
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.offline_sync CASCADE;
DROP TABLE IF EXISTS public.requests CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Create users table for volunteers and admins
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('volunteer', 'admin')) DEFAULT 'volunteer',
  location TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create requests table for victim requests
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT NOT NULL CHECK (status IN ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  
  -- Victim information (anonymous users)
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_info TEXT,
  location TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  people_count INTEGER DEFAULT 1,
  
  -- Assignment tracking
  assigned_volunteer_id UUID REFERENCES public.users(id),
  assignment_method TEXT CHECK (assignment_method IN ('self_accepted', 'admin_assigned')),
  assigned_at TIMESTAMP WITH TIME ZONE,
  accepted_by_volunteer BOOLEAN DEFAULT false,
  accepted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table for communication
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id),
  recipient_id UUID REFERENCES public.users(id),
  content TEXT NOT NULL,
  title TEXT,
  message_type TEXT DEFAULT 'general',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for requests table (open access for emergency coordination)
CREATE POLICY "Anyone can view requests" ON public.requests FOR SELECT USING (true);
CREATE POLICY "Anyone can create requests" ON public.requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Volunteers and admins can update requests" ON public.requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('volunteer', 'admin'))
);

-- RLS Policies for messages table
CREATE POLICY "Users can view messages for their requests" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.requests WHERE requests.id = request_id)
);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id OR sender_id IS NULL
);

-- Create indexes for performance
CREATE INDEX idx_requests_status ON public.requests(status);
CREATE INDEX idx_requests_assigned_volunteer ON public.requests(assigned_volunteer_id);
CREATE INDEX idx_requests_created_at ON public.requests(created_at);
CREATE INDEX idx_messages_request_id ON public.messages(request_id);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
