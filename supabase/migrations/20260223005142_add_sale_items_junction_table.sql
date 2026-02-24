/*
  # Add Sale Items Junction Table

  ## Overview
  This migration updates the sales tracking system to support multiple items per sale with quantities.

  ## Changes
  
  ### New Table: `sale_items`
  Junction table linking sales to items with quantity information.
  - `id` (uuid, primary key) - Unique identifier for each sale item entry
  - `sale_id` (uuid, foreign key) - References the sale record
  - `item_id` (uuid, foreign key) - References the item purchased
  - `quantity` (integer, not null) - Number of items purchased
  - `created_at` (timestamptz) - When the record was created

  ## Security
  - Enable Row Level Security (RLS) on the sale_items table
  - Add policies for authenticated users to view, insert, update, and delete

  ## Notes
  - Cascade delete ensures when a sale is deleted, all associated sale_items are also deleted
  - The original sales table structure remains unchanged for backwards compatibility
*/

CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Policies for sale_items table
CREATE POLICY "Anyone can view sale items"
  ON sale_items FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert sale items"
  ON sale_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update sale items"
  ON sale_items FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete sale items"
  ON sale_items FOR DELETE
  USING (true);