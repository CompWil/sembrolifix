/*
  # Remove unused item_id column from sales table
  
  The sales table had an item_id column that was not being used. 
  Items are linked to sales through the sale_items junction table instead.
  This column was causing schema confusion and needed to be removed.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'item_id'
  ) THEN
    ALTER TABLE sales DROP COLUMN item_id;
  END IF;
END $$;
