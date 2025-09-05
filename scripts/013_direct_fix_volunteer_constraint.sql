-- Direct fix for volunteer assignment foreign key constraint issue
-- This script removes the foreign key constraint and changes the column type

-- Step 1: Drop the foreign key constraint
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_assigned_volunteer_id_fkey;

-- Step 2: Change the column type from uuid to text to support anonymous volunteer IDs
ALTER TABLE requests ALTER COLUMN assigned_volunteer_id TYPE text USING assigned_volunteer_id::text;

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_requests_assigned_volunteer_id ON requests(assigned_volunteer_id);

-- Step 4: Create or replace the volunteer assignment function
CREATE OR REPLACE FUNCTION accept_request_by_volunteer(
    request_id_param uuid,
    volunteer_id_param text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the request with volunteer assignment
    UPDATE requests 
    SET 
        assigned_volunteer_id = volunteer_id_param,
        status = 'assigned',
        accepted_by_volunteer = true,
        accepted_at = NOW(),
        assigned_at = NOW(),
        updated_at = NOW()
    WHERE id = request_id_param 
    AND (assigned_volunteer_id IS NULL OR assigned_volunteer_id = '');
    
    -- Check if the update was successful
    IF FOUND THEN
        -- Update volunteer availability in volunteers table
        UPDATE volunteers 
        SET 
            is_available = false,
            updated_at = NOW()
        WHERE anonymous_volunteer_id = volunteer_id_param;
        
        RETURN true;
    ELSE
        RETURN false;
    END IF;
END;
$$;

-- Step 5: Create function to complete request
CREATE OR REPLACE FUNCTION complete_request_by_volunteer(
    request_id_param uuid,
    volunteer_id_param text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the request as completed
    UPDATE requests 
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = request_id_param 
    AND assigned_volunteer_id = volunteer_id_param;
    
    -- Check if the update was successful
    IF FOUND THEN
        -- Make volunteer available again
        UPDATE volunteers 
        SET 
            is_available = true,
            updated_at = NOW()
        WHERE anonymous_volunteer_id = volunteer_id_param;
        
        RETURN true;
    ELSE
        RETURN false;
    END IF;
END;
$$;
