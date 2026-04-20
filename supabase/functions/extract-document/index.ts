import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExtractionResult {
  tanggal_dokumen: string | null;
  penerima: string | null;
  shipping: string | null;
  nama_produk: string | null;
  qty: number | null;
  upload_date: string | null;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

async function parseExcel(buffer: Uint8Array): Promise<Record<string, string>[]> {
  const { read, utils } = await import("npm:xlsx@0.18.5");
  const workbook = read(buffer);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return utils.sheet_to_json(worksheet);
}

async function extractDataFromDocument(
  base64Data: string,
  fileType: string,
  supabase: any
): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    tanggal_dokumen: null,
    penerima: null,
    shipping: null,
    nama_produk: null,
    qty: null,
    upload_date: new Date().toISOString().split('T')[0],
  };

  if (!base64Data) {
    return result;
  }

  try {
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    let rows: Record<string, string>[] = [];

    if (fileType === 'text/csv') {
      const text = new TextDecoder().decode(buffer);
      rows = parseCSV(text);
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
               fileType === 'application/vnd.ms-excel') {
      rows = await parseExcel(buffer);
    } else {
      const text = new TextDecoder().decode(buffer);
      const dateMatch = text.match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/);
      if (dateMatch) {
        result.tanggal_dokumen = dateMatch[0];
      }
      return result;
    }

    if (rows.length === 0) return result;

    const firstRow = rows[0];

    // Extract upload date (use today's date as upload date)
    result.upload_date = new Date().toISOString().split('T')[0];

    // Extract tanggal_dokumen from first matching column
    const dateKeys = Object.keys(firstRow).filter(k =>
      k.toLowerCase().includes('date') ||
      k.toLowerCase().includes('tanggal') ||
      k.toLowerCase().includes('tgl')
    );
    if (dateKeys.length > 0) {
      const dateStr = firstRow[dateKeys[0]];
      const cleanDate = dateStr.match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/);
      if (cleanDate) {
        result.tanggal_dokumen = cleanDate[0];
      }
    }

    // Extract penerima from order_receiver_name table
    const receiverKeys = Object.keys(firstRow).filter(k =>
      k.toLowerCase().includes('receiver') ||
      k.toLowerCase().includes('buyer') ||
      k.toLowerCase().includes('penerima') ||
      k.toLowerCase().includes('name')
    );

    if (receiverKeys.length > 0) {
      const receiverValue = firstRow[receiverKeys[0]].toLowerCase();
      const { data: receivers } = await supabase
        .from('order_receiver_name')
        .select('name')
        .ilike('name', `%${receiverValue}%`)
        .maybeSingle();

      if (receivers) {
        result.penerima = receivers.name;
      }
    }

    // Extract nama_produk from product_info table
    const productKeys = Object.keys(firstRow).filter(k =>
      k.toLowerCase().includes('product') ||
      k.toLowerCase().includes('item') ||
      k.toLowerCase().includes('barang') ||
      k.toLowerCase().includes('nama')
    );

    if (productKeys.length > 0) {
      const productValue = firstRow[productKeys[0]].toLowerCase();
      const { data: products } = await supabase
        .from('product_info')
        .select('category_name')
        .ilike('category_name', `%${productValue}%`)
        .maybeSingle();

      if (products) {
        result.nama_produk = products.category_name;
      }
    }

    // Extract shipping from shipping_method table
    const shippingKeys = Object.keys(firstRow).filter(k =>
      k.toLowerCase().includes('shipping') ||
      k.toLowerCase().includes('carrier') ||
      k.toLowerCase().includes('method')
    );

    if (shippingKeys.length > 0) {
      const shippingValue = firstRow[shippingKeys[0]].toUpperCase();
      const { data: shippingMethods } = await supabase
        .from('shipping_method')
        .select('method_name')
        .ilike('method_name', `%${shippingValue}%`)
        .maybeSingle();

      if (shippingMethods) {
        result.shipping = shippingMethods.method_name;
      }
    }

    // Extract qty
    const qtyKeys = Object.keys(firstRow).filter(k =>
      k.toLowerCase().includes('qty') ||
      k.toLowerCase().includes('quantity') ||
      k.toLowerCase().includes('jumlah') ||
      k.toLowerCase().includes('juml')
    );

    if (qtyKeys.length > 0) {
      const qtyValue = parseInt(firstRow[qtyKeys[0]]);
      if (!isNaN(qtyValue)) {
        result.qty = qtyValue;
      }
    }

  } catch (e) {
    console.error("Error processing document:", e);
  }

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const { base64Image, fileType } = await req.json();

    const supabase = createClient(supabaseUrl, supabaseKey);
    const extractedData = await extractDataFromDocument(base64Image, fileType, supabase);

    const { data, error } = await supabase
      .from("document_extractions")
      .insert([
        {
          tanggal_dokumen: extractedData.tanggal_dokumen,
          penerima: extractedData.penerima,
          shipping: extractedData.shipping,
          nama_produk: extractedData.nama_produk,
          qty: extractedData.qty,
          raw_document_data: extractedData,
        },
      ])
      .select();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to store extraction data" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify(extractedData),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ error: "Processing failed" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
