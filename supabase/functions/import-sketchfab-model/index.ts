import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GLB_MAGIC = 0x46546C67; // "glTF"
const JSON_CHUNK_TYPE = 0x4E4F534A; // "JSON"

/** Parse GLB JSON chunk to extract mesh/node/material names */
function parseGlbMeshNames(buffer: ArrayBuffer): { meshNames: string[]; nodeNames: string[]; materialNames: string[] } {
  const empty = { meshNames: [], nodeNames: [], materialNames: [] };
  if (buffer.byteLength < 20) return empty;
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) return empty;
  const chunkLength = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);
  if (chunkType !== JSON_CHUNK_TYPE) return empty;
  
  const jsonBytes = new Uint8Array(buffer, 20, Math.min(chunkLength, buffer.byteLength - 20));
  const jsonStr = new TextDecoder().decode(jsonBytes);
  let gltfJson: any;
  try { gltfJson = JSON.parse(jsonStr); } catch { return empty; }
  
  return {
    meshNames: (gltfJson.meshes || []).map((m: any) => m.name).filter(Boolean),
    nodeNames: (gltfJson.nodes || []).map((n: any) => n.name).filter(Boolean),
    materialNames: (gltfJson.materials || []).map((m: any) => m.name).filter(Boolean),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { uid, name, sketchfabToken, category_id } = await req.json();
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

    // 3. Parse GLB to extract mesh names (server-side analysis)
    console.log(`[import] Parsing GLB for mesh names...`);
    const { meshNames, nodeNames, materialNames } = parseGlbMeshNames(arrayBuffer);
    const allNames = meshNames.length > 0 ? meshNames : nodeNames;
    console.log(`[import] Found ${meshNames.length} meshes, ${nodeNames.length} nodes, ${materialNames.length} materials`);

    // 4. Upload to Supabase Storage
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

    // 5. Insert into models table (with mesh_parts and category_id)
    const displayName = name || `Sketchfab ${uid}`;
    let modelId: string | null = null;
    const modelData = {
      display_name: displayName,
      file_url: fileUrl,
      file_size: fileSize,
      media_type: "glb",
      mesh_parts: allNames,
      category_id: category_id || null,
    };

    // Check if already exists
    const { data: existing } = await supabase
      .from("models")
      .select("id")
      .eq("file_name", fileName)
      .maybeSingle();

    if (existing) {
      const { data: updated } = await supabase
        .from("models")
        .update(modelData)
        .eq("id", existing.id)
        .select("id")
        .single();
      modelId = updated?.id || existing.id;
      console.log(`[import] Updated existing model: ${modelId}`);
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("models")
        .insert({ file_name: fileName, ...modelData })
        .select("id")
        .single();
      if (insertErr) {
        console.error("[import] DB insert error:", insertErr);
      } else {
        modelId = inserted?.id || null;
        console.log(`[import] Inserted new model: ${modelId}`);
      }
    }

    console.log(`[import] ✅ Imported ${displayName} (${(fileSize / 1048576).toFixed(1)} MB, ${allNames.length} mesh parts)`);

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        fileUrl,
        fileSize,
        displayName,
        modelId,
        meshParts: allNames,
        meshCount: meshNames.length,
        nodeCount: nodeNames.length,
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
