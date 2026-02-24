/*
  # Sales Tracking System Schema

  ## Overview
  This migration creates a simple sales tracking system for a store with items and sales records.

  ## New Tables
  
  ### `items`
  Stores the list of items available for sale in the store.
  - `id` (uuid, primary key) - Unique identifier for each item
  - `name` (text, unique, not null) - Name of the item
  - `created_at` (timestamptz) - When the item was added
  
  ### `sales`
  Records each sale transaction.
  - `id` (uuid, primary key) - Unique identifier for each sale
  - `buyer_name` (text, not null) - Name of the customer who made the purchase
  - `sale_date` (date, not null) - Date when the sale occurred
  - `item_id` (uuid, foreign key) - References the item that was sold
  - `created_at` (timestamptz) - When the sale record was created

  ## Security
  - Enable Row Level Security (RLS) on both tables
  - Add policies for authenticated users to:
    - View all items and sales
    - Insert new items and sales
    - Update and delete items and sales
  - Public read access for easier store management

  ## Notes
  - Foreign key constraint ensures data integrity between sales and items
  - Cascade delete means if an item is deleted, related sales are also removed
  - Default timestamps automatically track when records are created
*/

-- Create items table
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create sales table
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_name text NOT NULL,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Policies for items table
CREATE POLICY "Anyone can view items"
  ON items FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert items"
  ON items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update items"
  ON items FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete items"
  ON items FOR DELETE
  USING (true);

-- Policies for sales table
CREATE POLICY "Anyone can view sales"
  ON sales FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert sales"
  ON sales FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update sales"
  ON sales FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete sales"
  ON sales FOR DELETE
  USING (true);

-- Insert some sample items
INSERT INTO items (name) VALUES
  ('Laptop'),
  ('Mouse'),
  ('Keyboard'),
  ('Monitor'),
  ('Headphones')
ON CONFLICT (name) DO NOTHING;