-- Add missing anonymous columns to existing tables
-- This fixes the schema mismatch causing sync errors

-- Add anonymous_victim_id column to requests table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'requests' AND column_name = 'anonymous_victim_id') THEN
        ALTER TABLE public.requests ADD COLUMN anonymous_victim_id TEXT;
        
        -- Create index for performance
        CREATE INDEX IF NOT EXISTS idx_requests_anonymous_victim_id ON public.requests(anonymous_victim_id);
        
        RAISE NOTICE 'Added anonymous_victim_id column to requests table';
    ELSE
        RAISE NOTICE 'anonymous_victim_id column already exists in requests table';
    END IF;
END $$;

-- Add anonymous columns to messages table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'anonymous_sender_id') THEN
        ALTER TABLE public.messages ADD COLUMN anonymous_sender_id TEXT;
        
        RAISE NOTICE 'Added anonymous_sender_id column to messages table';
    ELSE
        RAISE NOTICE 'anonymous_sender_id column already exists in messages table';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'messages' AND column_name = 'anonymous_recipient_id') THEN
        ALTER TABLE public.messages ADD COLUMN anonymous_recipient_id TEXT;
        
        -- Create index for performance
        CREATE INDEX IF NOT EXISTS idx_messages_anonymous_recipient_id ON public.messages(anonymous_recipient_id);
        
        RAISE NOTICE 'Added anonymous_recipient_id column to messages table';
    ELSE
        RAISE NOTICE 'anonymous_recipient_id column already exists in messages table';
    END IF;
END $$;

-- Add contact_name and contact_phone columns to requests table for better anonymous user support
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'requests' AND column_name = 'contact_name') THEN
        ALTER TABLE public.requests ADD COLUMN contact_name TEXT;
        
        RAISE NOTICE 'Added contact_name column to requests table';
    ELSE
        RAISE NOTICE 'contact_name column already exists in requests table';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'requests' AND column_name = 'contact_phone') THEN
        ALTER TABLE public.requests ADD COLUMN contact_phone TEXT;
        
        RAISE NOTICE 'Added contact_phone column to requests table';
    ELSE
        RAISE NOTICE 'contact_phone column already exists in requests table';
    END IF;
END $$;

-- Add assignment tracking columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'requests' AND column_name = 'accepted_by_volunteer') THEN
        ALTER TABLE public.requests ADD COLUMN accepted_by_volunteer BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Added accepted_by_volunteer column to requests table';
    ELSE
        RAISE NOTICE 'accepted_by_volunteer column already exists in requests table';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'requests' AND column_name = 'accepted_at') THEN
        ALTER TABLE public.requests ADD COLUMN accepted_at TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE 'Added accepted_at column to requests table';
    ELSE
        RAISE NOTICE 'accepted_at column already exists in requests table';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'requests' AND column_name = 'assignment_method') THEN
        ALTER TABLE public.requests ADD COLUMN assignment_method TEXT;
        
        RAISE NOTICE 'Added assignment_method column to requests table';
    ELSE
        RAISE NOTICE 'assignment_method column already exists in requests table';
    END IF;
END $$;

-- Ensure RLS policies allow anonymous access
DROP POLICY IF EXISTS "Anyone can view requests" ON public.requests;
DROP POLICY IF EXISTS "Anyone can create requests" ON public.requests;
DROP POLICY IF EXISTS "Anyone can update requests" ON public.requests;

CREATE POLICY "Anyone can view requests" ON public.requests FOR SELECT USING (true);
CREATE POLICY "Anyone can create requests" ON public.requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update requests" ON public.requests FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can view messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can send messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can update messages" ON public.messages;

CREATE POLICY "Anyone can view messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Anyone can send messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update messages" ON public.messages FOR UPDATE USING (true);

-- Create offline_sync table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.offline_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  anonymous_user_id TEXT,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  data JSONB,
  synced BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on offline_sync table
ALTER TABLE public.offline_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can manage sync data" ON public.offline_sync;
CREATE POLICY "Anyone can manage sync data" ON public.offline_sync FOR ALL USING (true);

-- Create index for offline sync performance
CREATE INDEX IF NOT EXISTS idx_offline_sync_synced ON public.offline_sync(synced);
CREATE INDEX IF NOT EXISTS idx_offline_sync_anonymous_user_id ON public.offline_sync(anonymous_user_id);

-- Wrapped final notice in DO block to fix syntax error
DO $$ 
BEGIN
    RAISE NOTICE 'Database schema migration completed successfully';
END $$;
