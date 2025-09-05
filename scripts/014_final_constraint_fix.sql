-- Final fix for foreign key constraints and UUID issues
-- This script removes all problematic constraints and fixes data types

-- Step 1: Remove foreign key constraint on requests.assigned_volunteer_id
DO $$
BEGIN
    -- Drop the foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'requests_assigned_volunteer_id_fkey'
        AND table_name = 'requests'
    ) THEN
        ALTER TABLE requests DROP CONSTRAINT requests_assigned_volunteer_id_fkey;
        RAISE NOTICE 'Dropped foreign key constraint requests_assigned_volunteer_id_fkey';
    END IF;
END $$;

-- Step 2: Change assigned_volunteer_id from uuid to text to support anonymous volunteers
DO $$
BEGIN
    -- Check if column is uuid type and change to text
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'requests' 
        AND column_name = 'assigned_volunteer_id' 
        AND data_type = 'uuid'
    ) THEN
        -- First set all NULL values to empty string to avoid conversion issues
        UPDATE requests SET assigned_volunteer_id = NULL WHERE assigned_volunteer_id IS NULL;
        
        -- Change column type to text
        ALTER TABLE requests ALTER COLUMN assigned_volunteer_id TYPE text USING assigned_volunteer_id::text;
        RAISE NOTICE 'Changed assigned_volunteer_id from uuid to text';
    END IF;
END $$;

-- Step 3: Ensure volunteers table can handle null values properly
DO $$
BEGIN
    -- Make sure id column allows nulls temporarily for anonymous volunteers
    ALTER TABLE volunteers ALTER COLUMN id DROP NOT NULL;
    RAISE NOTICE 'Made volunteers.id nullable for anonymous volunteers';
END $$;

-- Step 4: Create or replace the volunteer assignment function
CREATE OR REPLACE FUNCTION accept_request_by_volunteer(
    request_id_param uuid,
    volunteer_id_param text
) RETURNS boolean AS $$
BEGIN
    -- Update the request with the volunteer assignment
    UPDATE requests 
    SET 
        assigned_volunteer_id = volunteer_id_param,
        status = 'assigned',
        assigned_at = NOW(),
        accepted_by_volunteer = true,
        accepted_at = NOW()
    WHERE id = request_id_param 
    AND (status = 'pending' OR status = 'open');
    
    -- Check if the update was successful
    IF FOUND THEN
        -- Update volunteer availability if they exist in volunteers table
        UPDATE volunteers 
        SET is_available = false, updated_at = NOW()
        WHERE anonymous_volunteer_id = volunteer_id_param;
        
        RETURN true;
    ELSE
        RETURN false;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to complete requests
CREATE OR REPLACE FUNCTION complete_request_by_volunteer(
    request_id_param uuid,
    volunteer_id_param text
) RETURNS boolean AS $$
BEGIN
    -- Update the request status to completed
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
        SET is_available = true, updated_at = NOW()
        WHERE anonymous_volunteer_id = volunteer_id_param;
        
        RETURN true;
    ELSE
        RETURN false;
    END IF;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    RAISE NOTICE 'Database constraints and functions updated successfully';
END $$;
