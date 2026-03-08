import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GLB_MAGIC = 0x46546C67; // "glTF"
const JSON_CHUNK_TYPE = 0x4E4F534A;

/**
 * Server-side GLB analysis — extracts mesh/node/material names
 * from GLB files stored in Supabase Storage.
 * 
 * POST body: { file_url: string, model_id: string }
 * Returns: { meshNames: string[], nodeNames: string[], materialNames: string[] }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_url, model_id } = await req.json();
    if (!file_url) {
      return new Response(JSON.stringify({ error: "file_url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch only the first 512KB (JSON chunk is usually < 100KB)
    let buffer: ArrayBuffer;
    try {
      const res = await fetch(file_url, { headers: { Range: "bytes=0-524287" } });
      buffer = await res.arrayBuffer();
    } catch {
      const res = await fetch(file_url);
      buffer = await res.arrayBuffer();
    }

    // Parse GLB JSON chunk
    const view = new DataView(buffer);
    if (buffer.byteLength < 20) {
      return new Response(JSON.stringify({ meshNames: [], nodeNames: [], materialNames: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const magic = view.getUint32(0, true);
    if (magic !== GLB_MAGIC) {
      return new Response(JSON.stringify({ error: "Not a valid GLB file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chunkLength = view.getUint32(12, true);
    const chunkType = view.getUint32(16, true);

    if (chunkType !== JSON_CHUNK_TYPE) {
      return new Response(JSON.stringify({ meshNames: [], nodeNames: [], materialNames: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jsonBytes = new Uint8Array(buffer, 20, Math.min(chunkLength, buffer.byteLength - 20));
    const jsonStr = new TextDecoder().decode(jsonBytes);
    const gltfJson = JSON.parse(jsonStr);

    const meshNames = (gltfJson.meshes || []).map((m: any) => m.name).filter(Boolean);
    const nodeNames = (gltfJson.nodes || []).map((n: any) => n.name).filter(Boolean);
    const materialNames = (gltfJson.materials || []).map((m: any) => m.name).filter(Boolean);

    // If model_id provided, update the models table
    if (model_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from("models").update({
        mesh_parts: meshNames,
      }).eq("id", model_id);
    }

    return new Response(JSON.stringify({
      meshNames,
      nodeNames,
      materialNames,
      totalMeshes: gltfJson.meshes?.length || 0,
      totalNodes: gltfJson.nodes?.length || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
