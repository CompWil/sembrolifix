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
}

function extractDataFromDocument(base64Data: string): ExtractionResult {
  const result: ExtractionResult = {
    tanggal_dokumen: null,
    penerima: null,
    shipping: null,
    nama_produk: null,
    qty: null,
  };

  if (!base64Data) {
    return result;
  }

  try {
    const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    const text = new TextDecoder().decode(buffer);

    // Extract date (YYYY-MM-DD format or variations)
    const dateMatch = text.match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/);
    if (dateMatch) {
      result.tanggal_dokumen = dateMatch[0];
    }

    // Extract penerima (recipient/buyer name)
    const nameMatch = text.match(/(?:To|Recipient|Name|Buyer|Penerima|Nama Penerima)[\s:]*([A-Za-z\s\u0600-\u06FF]+)(?=\n|$|Address|Tel|Alamat|Jalan)/i);
    if (nameMatch) {
      result.penerima = nameMatch[1].trim();
    }

    // Extract shipping carrier (SPX, J&T, JNE)
    if (text.match(/SPX/i)) {
      result.shipping = "SPX";
    } else if (text.match(/J&T|J\s*&\s*T/i)) {
      result.shipping = "J&T";
    } else if (text.match(/JNE/i)) {
      result.shipping = "JNE";
    }

    // Extract nama produk (product name)
    const productMatch = text.match(/(?:Item|Product|Description|Item Purchased|Nama Produk|Produk|Barang)[\s:]*([A-Za-z0-9\s\-\u0600-\u06FF]+)(?=\n|Qty|Quantity|Jumlah|$)/i);
    if (productMatch) {
      result.nama_produk = productMatch[1].trim();
    }

    // Extract qty (quantity)
    const qtyMatch = text.match(/(?:Qty|Quantity|Jumlah|Juml)[\s:]*(\d+)/i);
    if (qtyMatch) {
      result.qty = parseInt(qtyMatch[1]);
    } else {
      const qtyAltMatch = text.match(/(\d+)\s*(?:pcs|pieces|pce|qty|buah|pca)/i);
      if (qtyAltMatch) {
        result.qty = parseInt(qtyAltMatch[1]);
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

    const { imageData, base64Image } = await req.json();

    const extractedData = extractDataFromDocument(base64Image || imageData);

    const supabase = createClient(supabaseUrl, supabaseKey);

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
