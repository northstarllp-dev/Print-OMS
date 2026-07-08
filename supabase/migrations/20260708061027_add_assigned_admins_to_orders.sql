-- Add assigned_admins column to orders table
ALTER TABLE orders 
ADD COLUMN assigned_admins UUID[] DEFAULT '{}';
