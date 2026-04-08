import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExtractionResult {
  extracted_date: string | null;
  buyer_name: string | null;
  shipping_carrier: string | null;
  product_name: string | null;
  quantity: number | null;
}

function extractDataFromDocument(base64Image: string): ExtractionResult {
  const result: ExtractionResult = {
    extracted_date: null,
    buyer_name: null,
    shipping_carrier: null,
    product_name: null,
    quantity: null,
  };

  if (!base64Image) {
    return result;
  }

  try {
    const imageBuffer = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0));
    const text = new TextDecoder().decode(imageBuffer);

    // Extract date (YYYY-MM-DD format or variations)
    const dateMatch = text.match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/);
    if (dateMatch) {
      result.extracted_date = dateMatch[0];
    }

    // Extract buyer name (look for keywords like "To:", "Recipient:", "Name:")
    const nameMatch = text.match(/(?:To|Recipient|Name|Buyer)[\s:]*([A-Za-z\s]+)(?=\n|$|Address|Tel)/i);
    if (nameMatch) {
      result.buyer_name = nameMatch[1].trim();
    }

    // Extract shipping carrier (SPX, J&T, JNE)
    if (text.match(/SPX/i)) {
      result.shipping_carrier = "SPX";
    } else if (text.match(/J&T|J\s*&\s*T/i)) {
      result.shipping_carrier = "J&T";
    } else if (text.match(/JNE/i)) {
      result.shipping_carrier = "JNE";
    }

    // Extract product name (look for keywords like "Item:", "Product:", "Description:")
    const productMatch = text.match(/(?:Item|Product|Description|Item Purchased)[\s:]*([A-Za-z0-9\s\-]+)(?=\n|Qty|Quantity|$)/i);
    if (productMatch) {
      result.product_name = productMatch[1].trim();
    }

    // Extract quantity (look for "Qty:", "Quantity:", or numbers before "pcs", "pieces", etc.)
    const qtyMatch = text.match(/(?:Qty|Quantity)[\s:]*(\d+)/i);
    if (qtyMatch) {
      result.quantity = parseInt(qtyMatch[1]);
    } else {
      const qtyAltMatch = text.match(/(\d+)\s*(?:pcs|pieces|pce|qty)/i);
      if (qtyAltMatch) {
        result.quantity = parseInt(qtyAltMatch[1]);
      }
    }
  } catch (e) {
    console.error("Error processing image:", e);
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
          extracted_date: extractedData.extracted_date,
          buyer_name: extractedData.buyer_name,
          shipping_carrier: extractedData.shipping_carrier,
          product_name: extractedData.product_name,
          quantity: extractedData.quantity,
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
