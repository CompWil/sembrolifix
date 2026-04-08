/*
  # Add Document Extraction Table

  1. New Tables
    - `document_extractions`
      - `id` (uuid, primary key)
      - `extracted_date` (date - from document)
      - `buyer_name` (text - recipient)
      - `shipping_carrier` (text - SPX, J&T, JNE, etc.)
      - `product_name` (text - item purchased)
      - `quantity` (integer - qty)
      - `raw_document_data` (jsonb - original extraction data)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on `document_extractions` table
*/

CREATE TABLE IF NOT EXISTS document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extracted_date date,
  buyer_name text,
  shipping_carrier text,
  product_name text,
  quantity integer,
  raw_document_data jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert extraction data"
  ON document_extractions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view extraction data"
  ON document_extractions
  FOR SELECT
  USING (true);
