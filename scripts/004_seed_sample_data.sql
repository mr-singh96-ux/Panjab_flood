-- Updated seed data to work with anonymous system
-- Create sample anonymous users for testing
INSERT INTO public.users (full_name, phone, role, location, anonymous_id) VALUES
('Emergency Admin', '+1-555-0100', 'admin', 'Emergency Command Center', 'admin-001'),
('Volunteer Team Alpha', '+1-555-0200', 'volunteer', 'Mobile Unit A', 'volunteer-001'),
('Volunteer Team Beta', '+1-555-0300', 'volunteer', 'Mobile Unit B', 'volunteer-002');

-- Create sample anonymous victim
INSERT INTO public.users (full_name, phone, role, location, anonymous_id) VALUES
('Anonymous Victim', '+1-555-0400', 'victim', 'Downtown Flood Zone', 'victim-001');

-- Sample emergency requests from anonymous users
INSERT INTO public.requests (anonymous_victim_id, title, description, category, priority, location, latitude, longitude, people_count, contact_info)
VALUES 
('victim-001', 'Emergency Water Supply', 'Family of 4 needs clean drinking water. Our supply ran out yesterday.', 'water', 'high', 'Downtown Flood Zone Area A', 40.7128, -74.0060, 4, '+1-555-0400'),
('victim-001', 'Medical Assistance Needed', 'Elderly person needs medication refill - diabetes insulin running low.', 'medical', 'critical', 'Downtown Flood Zone Area B', 40.7130, -74.0058, 2, '+1-555-0400');

-- Sample request with authenticated user (if any exist)
INSERT INTO public.requests (victim_id, title, description, category, priority, location, latitude, longitude, people_count, contact_info)
SELECT 
  u.id,
  'Food Supplies Needed',
  'Shelter housing 20 people needs food supplies for next 3 days.',
  'food',
  'medium',
  'Community Center Shelter',
  40.7125,
  -74.0065,
  20,
  '+1-555-SHELTER'
FROM public.users u 
WHERE u.role = 'victim' AND u.auth_user_id IS NOT NULL
LIMIT 1;
