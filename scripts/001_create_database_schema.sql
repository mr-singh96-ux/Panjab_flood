-- Modified schema to support anonymous users for emergency access
-- Create enum types for better data integrity
CREATE TYPE user_role AS ENUM ('victim', 'volunteer', 'admin');
CREATE TYPE request_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE request_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE message_type AS ENUM ('assignment', 'completion', 'update', 'system');

-- Users table (supports both authenticated and anonymous users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- nullable for anonymous users
  email TEXT,
  full_name TEXT,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'victim',
  location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_available BOOLEAN DEFAULT true, -- for volunteers
  anonymous_id TEXT, -- for tracking anonymous users
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Help requests from victims (supports anonymous requests)
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  victim_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  anonymous_victim_id TEXT, -- for anonymous requests
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- food, water, medical, shelter, rescue, etc.
  priority request_priority NOT NULL DEFAULT 'medium',
  status request_status NOT NULL DEFAULT 'pending',
  location TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  people_count INTEGER DEFAULT 1,
  contact_info TEXT, -- phone/emergency contact for anonymous users
  assigned_volunteer_id UUID REFERENCES public.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages/notifications between users
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  anonymous_sender_id TEXT, -- for anonymous senders
  anonymous_recipient_id TEXT, -- for anonymous recipients
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
  message_type message_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Offline sync tracking for when connectivity is restored
CREATE TABLE IF NOT EXISTS public.offline_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  anonymous_user_id TEXT, -- for anonymous users
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL, -- insert, update, delete
  data JSONB,
  synced BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offline_sync ENABLE ROW LEVEL SECURITY;

-- Updated RLS policies to allow anonymous access for emergency situations
-- RLS Policies for users table - allow anonymous access
CREATE POLICY "Anyone can view users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Anyone can create user profiles" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update profiles" ON public.users FOR UPDATE USING (
  auth.uid() = auth_user_id OR auth.uid() IS NULL
);

-- RLS Policies for requests table - allow anonymous requests
CREATE POLICY "Anyone can view requests" ON public.requests FOR SELECT USING (true);
CREATE POLICY "Anyone can create requests" ON public.requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update requests" ON public.requests FOR UPDATE USING (true);

-- RLS Policies for messages table - allow anonymous messaging
CREATE POLICY "Anyone can view messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Anyone can send messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update messages" ON public.messages FOR UPDATE USING (true);

-- RLS Policies for offline_sync table - allow anonymous sync
CREATE POLICY "Anyone can manage sync data" ON public.offline_sync FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_priority ON public.requests(priority);
CREATE INDEX IF NOT EXISTS idx_requests_victim_id ON public.requests(victim_id);
CREATE INDEX IF NOT EXISTS idx_requests_anonymous_victim_id ON public.requests(anonymous_victim_id);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_volunteer_id ON public.requests(assigned_volunteer_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_anonymous_recipient_id ON public.messages(anonymous_recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON public.messages(is_read);
CREATE INDEX IF NOT EXISTS idx_offline_sync_synced ON public.offline_sync(synced);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_anonymous_id ON public.users(anonymous_id);
