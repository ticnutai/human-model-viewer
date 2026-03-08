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
    const { uid, name, sketchfabToken } = await req.json();
    if (!uid || !sketchfabToken) {
      return new Response(JSON.stringify({ error: "Missing uid or sketchfabToken" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Get download URL from Sketchfab
    console.log(`[import] Fetching download URL for ${uid}...`);
    const dlRes = await fetch(`https://api.sketchfab.com/v3/models/${uid}/download`, {
      headers: { Authorization: `Token ${sketchfabToken}` },
    });
    if (!dlRes.ok) {
      const errText = await dlRes.text();
      return new Response(JSON.stringify({ error: `Sketchfab download API error ${dlRes.status}: ${errText}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dlPayload = await dlRes.json();

    // Find GLB URL recursively
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
      return new Response(JSON.stringify({ error: "No GLB download URL found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Download the GLB file
    console.log(`[import] Downloading GLB from ${glbUrl.substring(0, 80)}...`);
    const fileRes = await fetch(glbUrl);
    if (!fileRes.ok) {
      return new Response(JSON.stringify({ error: `GLB download failed: ${fileRes.status}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blob = await fileRes.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const fileSize = arrayBuffer.byteLength;
    console.log(`[import] Downloaded ${(fileSize / 1048576).toFixed(1)} MB`);

    // 3. Upload to Supabase Storage
    const fileName = `sketchfab_${uid}.glb`;
    const { error: uploadError } = await supabase.storage
      .from("models")
      .upload(fileName, arrayBuffer, {
        contentType: "model/gltf-binary",
        upsert: true,
      });

    if (uploadError) {
      return new Response(JSON.stringify({ error: `Storage upload failed: ${uploadError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileUrl = `${supabaseUrl}/storage/v1/object/public/models/${fileName}`;

    // 4. Insert into models table
    const displayName = name || `Sketchfab ${uid}`;
    let modelId: string | null = null;

    // Check if already exists
    const { data: existing } = await supabase
      .from("models")
      .select("id")
      .eq("file_name", fileName)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { data: updated } = await supabase
        .from("models")
        .update({ display_name: displayName, file_url: fileUrl, file_size: fileSize, media_type: "glb" })
        .eq("id", existing.id)
        .select("id")
        .single();
      modelId = updated?.id || existing.id;
      console.log(`[import] Updated existing model: ${modelId}`);
    } else {
      // Insert new
      const { data: inserted, error: insertErr } = await supabase
        .from("models")
        .insert({ file_name: fileName, display_name: displayName, file_url: fileUrl, file_size: fileSize, media_type: "glb" })
        .select("id")
        .single();
      if (insertErr) {
        console.error("[import] DB insert error:", insertErr);
      } else {
        modelId = inserted?.id || null;
        console.log(`[import] Inserted new model: ${modelId}`);
      }
    }

    console.log(`[import] ✅ Imported ${displayName} (${(fileSize / 1048576).toFixed(1)} MB)`);

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        fileUrl,
        fileSize,
        displayName,
        modelId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[import] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
