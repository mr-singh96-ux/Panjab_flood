-- Remove foreign key constraint and allow anonymous volunteer assignment

-- First, drop the foreign key constraint if it exists
DO $$
BEGIN
    -- Check if the foreign key constraint exists and drop it
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'requests_assigned_volunteer_id_fkey' 
        AND table_name = 'requests'
    ) THEN
        ALTER TABLE requests DROP CONSTRAINT requests_assigned_volunteer_id_fkey;
        RAISE NOTICE 'Dropped foreign key constraint requests_assigned_volunteer_id_fkey';
    ELSE
        RAISE NOTICE 'Foreign key constraint requests_assigned_volunteer_id_fkey does not exist';
    END IF;
END $$;

-- Change assigned_volunteer_id to TEXT to allow anonymous volunteer IDs
DO $$
BEGIN
    -- Check if column is UUID type and change to TEXT
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'requests' 
        AND column_name = 'assigned_volunteer_id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE requests ALTER COLUMN assigned_volunteer_id TYPE TEXT;
        RAISE NOTICE 'Changed assigned_volunteer_id column type to TEXT';
    ELSE
        RAISE NOTICE 'assigned_volunteer_id column is already TEXT or does not exist';
    END IF;
END $$;

-- Create or replace the volunteer assignment function
CREATE OR REPLACE FUNCTION accept_request_by_volunteer(
    request_id_param UUID,
    volunteer_id_param TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    request_exists BOOLEAN;
BEGIN
    -- Check if request exists and is not already assigned
    SELECT EXISTS(
        SELECT 1 FROM requests 
        WHERE id = request_id_param 
        AND (assigned_volunteer_id IS NULL OR assigned_volunteer_id = '')
        AND status IN ('pending', 'open')
    ) INTO request_exists;
    
    IF NOT request_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Update the request with volunteer assignment
    UPDATE requests 
    SET 
        assigned_volunteer_id = volunteer_id_param,
        status = 'assigned',
        assigned_at = NOW(),
        accepted_by_volunteer = TRUE,
        accepted_at = NOW()
    WHERE id = request_id_param;
    
    -- Update volunteer availability in volunteers table if exists
    UPDATE volunteers 
    SET 
        is_available = FALSE,
        updated_at = NOW()
    WHERE anonymous_volunteer_id = volunteer_id_param;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create function to complete request and make volunteer available again
CREATE OR REPLACE FUNCTION complete_request_by_volunteer(
    request_id_param UUID,
    volunteer_id_param TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    request_exists BOOLEAN;
BEGIN
    -- Check if request exists and is assigned to this volunteer
    SELECT EXISTS(
        SELECT 1 FROM requests 
        WHERE id = request_id_param 
        AND assigned_volunteer_id = volunteer_id_param
        AND status = 'assigned'
    ) INTO request_exists;
    
    IF NOT request_exists THEN
        RETURN FALSE;
    END IF;
    
    -- Update the request as completed
    UPDATE requests 
    SET 
        status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = request_id_param;
    
    -- Make volunteer available again
    UPDATE volunteers 
    SET 
        is_available = TRUE,
        updated_at = NOW()
    WHERE anonymous_volunteer_id = volunteer_id_param;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    RAISE NOTICE 'Successfully updated volunteer assignment system to support anonymous volunteers';
END $$;
