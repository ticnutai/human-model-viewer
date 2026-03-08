import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Streaming import: downloads from Sketchfab and uploads to Supabase Storage
 * using chunked reading to avoid holding the entire file in memory at once.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { uid, name, hebrew_name } = await req.json();
    if (!uid) {
      return new Response(JSON.stringify({ error: "Missing uid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sketchfabToken = Deno.env.get("SKETCHFAB_API_TOKEN")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Get download URL from Sketchfab
    console.log(`[stream] Fetching download URL for ${uid}...`);
    const dlRes = await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`, {
      headers: { Authorization: `Token ${sketchfabToken}` },
    });
    if (!dlRes.ok) {
      const t = await dlRes.text();
      return new Response(JSON.stringify({ error: `Sketchfab API ${dlRes.status}: ${t.substring(0, 200)}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dlPayload = await dlRes.json();

    // Find URLs recursively
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
      return new Response(JSON.stringify({ error: "No download URL found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Stream-download into chunks to reduce peak memory
    console.log(`[stream] Downloading ${uid} via streaming...`);
    const fileRes = await fetch(glbUrl);
    if (!fileRes.ok || !fileRes.body) {
      return new Response(JSON.stringify({ error: `Download failed: ${fileRes.status}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read in 2MB chunks and collect
    const reader = fileRes.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalSize += value.byteLength;
      // Log progress every ~10MB
      if (totalSize % (10 * 1024 * 1024) < value.byteLength) {
        console.log(`[stream] ${uid}: ${(totalSize / 1048576).toFixed(1)} MB downloaded...`);
      }
    }

    console.log(`[stream] ${uid}: ${(totalSize / 1048576).toFixed(1)} MB total, assembling...`);

    // Assemble final buffer
    const finalBuffer = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      finalBuffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
    // Free chunk references
    chunks.length = 0;

    // 3. Upload to Supabase Storage
    const fileName = `sketchfab_${uid}.glb`;
    console.log(`[stream] Uploading ${fileName}...`);

    const { error: uploadError } = await supabase.storage
      .from("models")
      .upload(fileName, finalBuffer.buffer, {
        contentType: "model/gltf-binary",
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Upload: ${uploadError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
          file_size: totalSize,
          media_type: "glb",
        },
        { onConflict: "file_name" }
      );

    if (dbError) {
      await supabase.from("models").insert({
        file_name: fileName,
        display_name: displayName,
        hebrew_name: hebrew_name || "",
        file_url: fileUrl,
        file_size: totalSize,
        media_type: "glb",
      });
    }

    console.log(`[stream] ✅ ${displayName} (${(totalSize / 1048576).toFixed(1)} MB)`);

    return new Response(
      JSON.stringify({ success: true, fileName, fileUrl, fileSize: totalSize, displayName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[stream] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
