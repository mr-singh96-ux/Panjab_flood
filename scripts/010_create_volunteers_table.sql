-- Create volunteers table for anonymous volunteer registrations
CREATE TABLE IF NOT EXISTS volunteers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anonymous_volunteer_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    location TEXT NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_volunteers_anonymous_id ON volunteers(anonymous_volunteer_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_available ON volunteers(is_available);

-- Enable RLS
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;

-- Create policies for volunteers table
CREATE POLICY "Anyone can read volunteers" ON volunteers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert volunteers" ON volunteers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update volunteers" ON volunteers FOR UPDATE USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_volunteers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_volunteers_updated_at_trigger ON volunteers;
CREATE TRIGGER update_volunteers_updated_at_trigger
    BEFORE UPDATE ON volunteers
    FOR EACH ROW
    EXECUTE FUNCTION update_volunteers_updated_at();

-- Migrate any existing volunteer data from users table if it exists
INSERT INTO volunteers (anonymous_volunteer_id, full_name, phone, location, is_available, created_at)
SELECT 
    COALESCE(id::text, gen_random_uuid()::text) as anonymous_volunteer_id,
    COALESCE(full_name, 'Unknown Volunteer') as full_name,
    COALESCE(phone, '') as phone,
    COALESCE(location, '') as location,
    COALESCE(is_available, true) as is_available,
    COALESCE(created_at, NOW()) as created_at
FROM users 
WHERE role = 'volunteer'
ON CONFLICT (anonymous_volunteer_id) DO NOTHING;
