import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportItem {
  uid: string;
  name?: string;
  hebrew_name?: string;
}

async function importOne(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  sketchfabToken: string,
  item: ImportItem
): Promise<{ uid: string; success: boolean; error?: string; fileUrl?: string }> {
  const { uid, name, hebrew_name } = item;
  try {
    // 1. Get download URL
    const dlRes = await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`, {
      headers: { Authorization: `Token ${sketchfabToken}` },
    });
    if (!dlRes.ok) {
      const t = await dlRes.text();
      return { uid, success: false, error: `Sketchfab API ${dlRes.status}: ${t.substring(0, 200)}` };
    }

    const dlPayload = await dlRes.json();

    // Find download URLs recursively
    const findUrls = (obj: unknown, bag: string[] = []): string[] => {
      if (!obj || typeof obj !== "object") return bag;
      const o = obj as Record<string, unknown>;
      if (typeof o.url === "string") bag.push(o.url);
      Object.values(o).forEach((v) => {
        if (v && typeof v === "object") findUrls(v, bag);
      });
      return bag;
    };

    const urls = findUrls(dlPayload).filter((u) => u.startsWith("http"));
    const glbUrl = urls.find((u) => u.toLowerCase().includes(".glb")) || urls[0];
    if (!glbUrl) {
      return { uid, success: false, error: "No GLB download URL found" };
    }

    // 2. Download the file
    console.log(`[bulk] Downloading ${uid} from ${glbUrl.substring(0, 60)}...`);
    const fileRes = await fetch(glbUrl);
    if (!fileRes.ok) {
      return { uid, success: false, error: `Download failed: ${fileRes.status}` };
    }

    const blob = await fileRes.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    console.log(`[bulk] ${uid}: ${(fileSize / 1048576).toFixed(1)} MB`);

    // 3. Upload to storage
    const fileName = `sketchfab_${uid}.glb`;
    const { error: uploadError } = await supabase.storage
      .from("models")
      .upload(fileName, arrayBuffer, {
        contentType: "model/gltf-binary",
        upsert: true,
      });

    if (uploadError) {
      return { uid, success: false, error: `Upload: ${uploadError.message}` };
    }

    const fileUrl = `${supabaseUrl}/storage/v1/object/public/models/${fileName}`;

    // 4. Upsert into models table
    const displayName = name || `Sketchfab ${uid}`;
    const { error: dbError } = await supabase
      .from("models")
      .upsert(
        {
          file_name: fileName,
          display_name: displayName,
          hebrew_name: hebrew_name || "",
          file_url: fileUrl,
          file_size: fileSize,
          media_type: "glb",
        },
        { onConflict: "file_name" }
      );

    if (dbError) {
      // Try plain insert
      await supabase.from("models").insert({
        file_name: fileName,
        display_name: displayName,
        hebrew_name: hebrew_name || "",
        file_url: fileUrl,
        file_size: fileSize,
        media_type: "glb",
      });
    }

    console.log(`[bulk] ✅ ${displayName}`);
    return { uid, success: true, fileUrl };
  } catch (err) {
    return { uid, success: false, error: String(err) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { models } = (await req.json()) as { models: ImportItem[] };
    if (!models || !Array.isArray(models) || models.length === 0) {
      return new Response(JSON.stringify({ error: "Missing models array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sketchfabToken = Deno.env.get("SKETCHFAB_API_TOKEN")!;

    if (!sketchfabToken) {
      return new Response(JSON.stringify({ error: "SKETCHFAB_API_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Import sequentially with delay to respect rate limits
    const results = [];
    for (let i = 0; i < models.length; i++) {
      if (i > 0) {
        // Wait 5 seconds between requests to avoid 429
        await new Promise((r) => setTimeout(r, 5000));
      }
      const result = await importOne(supabase, supabaseUrl, sketchfabToken, models[i]);
      results.push(result);
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`[bulk] Done: ${succeeded} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({ succeeded, failed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[bulk] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
