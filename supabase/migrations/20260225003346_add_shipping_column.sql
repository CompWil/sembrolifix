/*
  # Add shipping column to sales table
  
  Add a shipping method column to track whether items are shipped via SPX or J&T.
  
  1. New Columns
    - `shipping` (text, not null, default 'SPX')
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'shipping'
  ) THEN
    ALTER TABLE sales ADD COLUMN shipping text NOT NULL DEFAULT 'SPX';
  END IF;
END $$;
