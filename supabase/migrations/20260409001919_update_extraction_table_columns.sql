/*
  # Update Document Extraction Table Columns

  1. Modified Tables
    - `document_extractions`
      - Renamed columns to match Indonesian language requirements
      - `extracted_date` → `tanggal_dokumen` (Uploaded Document Date)
      - `buyer_name` → `penerima` (Recipient/Buyer's Name)
      - `shipping_carrier` → `shipping` (Shipping Company)
      - `product_name` → `nama_produk` (Product Name)
      - `quantity` → `qty` (Quantity)
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_extractions' AND column_name = 'extracted_date'
  ) THEN
    ALTER TABLE document_extractions RENAME COLUMN extracted_date TO tanggal_dokumen;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_extractions' AND column_name = 'buyer_name'
  ) THEN
    ALTER TABLE document_extractions RENAME COLUMN buyer_name TO penerima;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_extractions' AND column_name = 'shipping_carrier'
  ) THEN
    ALTER TABLE document_extractions RENAME COLUMN shipping_carrier TO shipping;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_extractions' AND column_name = 'product_name'
  ) THEN
    ALTER TABLE document_extractions RENAME COLUMN product_name TO nama_produk;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_extractions' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE document_extractions RENAME COLUMN quantity TO qty;
  END IF;
END $$;
