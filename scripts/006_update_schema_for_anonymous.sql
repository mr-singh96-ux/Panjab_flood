-- Update database schema to support anonymous users
-- Add contact information fields to requests table for anonymous users
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Make victim_id nullable for anonymous requests
ALTER TABLE requests 
ALTER COLUMN victim_id DROP NOT NULL;

-- Update RLS policies to allow anonymous access during emergencies
DROP POLICY IF EXISTS "Users can view their own requests" ON requests;
DROP POLICY IF EXISTS "Users can create their own requests" ON requests;

-- Create more permissive policies for emergency access
CREATE POLICY "Allow anonymous request creation" ON requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous request viewing" ON requests
  FOR SELECT USING (true);

-- Allow admins and volunteers to update any request
CREATE POLICY "Allow request updates for coordination" ON requests
  FOR UPDATE USING (true);

-- Update messages table policies for anonymous access
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
CREATE POLICY "Allow message viewing for coordination" ON messages
  FOR SELECT USING (true);

CREATE POLICY "Allow message creation for coordination" ON messages
  FOR INSERT WITH CHECK (true);
