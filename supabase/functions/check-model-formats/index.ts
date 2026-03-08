import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // List all files in models bucket
    const { data: files, error } = await supabase.storage.from("models").list("", { limit: 100 });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const file of files || []) {
      if (!file.name.endsWith(".glb")) continue;
      const url = `${supabaseUrl}/storage/v1/object/public/models/${file.name}`;
      try {
        const res = await fetch(url, { headers: { Range: "bytes=0-7" } });
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const magic = new TextDecoder().decode(bytes.slice(0, 4));
        const isGlb = magic === "glTF";
        const isZip = magic.startsWith("PK");
        results.push({
          name: file.name,
          size: file.metadata?.size || 0,
          magic,
          isGlb,
          isZip,
          status: isGlb ? "✅ valid GLB" : isZip ? "❌ ZIP (needs extraction)" : "❓ unknown",
        });
      } catch (e) {
        results.push({ name: file.name, status: "error", error: String(e) });
      }
    }

    return new Response(JSON.stringify({ total: results.length, results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
