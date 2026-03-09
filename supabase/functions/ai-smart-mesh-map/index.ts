import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meshNames, modelName, hebrewName, modelUrl } = await req.json();

    if (!Array.isArray(meshNames) || meshNames.length === 0) {
      return new Response(JSON.stringify({ error: "meshNames array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create indexed mesh list for clarity
    const indexedMeshes = meshNames.map((name: string, i: number) => ({
      index: i,
      originalName: name,
    }));

    const contextInfo = [
      modelName ? `Model: "${modelName}"` : "",
      hebrewName ? `Hebrew name: "${hebrewName}"` : "",
      `Total parts: ${meshNames.length}`,
    ].filter(Boolean).join("\n");

    const systemPrompt = `You are an expert anatomist and 3D model analyst. You receive mesh part names from a 3D anatomical model file (.glb).

TASK: For EACH mesh part (by index), identify its anatomical structure and create a detailed info card.

ABSOLUTE RULES:
1. You MUST return EXACTLY ${meshNames.length} mappings - one per input index (0 to ${meshNames.length - 1}).
2. Even if multiple meshes share the same name, each index represents a DIFFERENT geometric segment. Identify each differently.
3. Use the MODEL NAME to understand context. Example: "Cardiac Anatomy External View" with 3 mesh segments named the same → these are likely different sub-regions (e.g., posterior wall, anterior wall, ostium).
4. If parts have descriptive names, use them. If generic (Object_0), deduce from model context.
5. NEVER merge parts. NEVER skip an index. Return ${meshNames.length} items.

For EACH part provide ALL these fields:
- meshIndex: number (MUST match input index)
- originalMeshName: string (from input)
- hebrewName: Hebrew anatomical name (prefer unique per part)
- englishName: English anatomical name (prefer unique per part)
- latinName: Latin anatomical name
- system: Body system in Hebrew
- icon: Single emoji
- summary: One detailed sentence in Hebrew
- functionHe: Function in Hebrew (2-3 sentences)
- facts: Array of 3 facts in Hebrew
- diseases: Array of 2-3 diseases in Hebrew

Context:
${contextInfo}

Return ONLY valid JSON: {"mappings": [<exactly ${meshNames.length} items>]}`;

    const userContent = `Map these ${meshNames.length} mesh parts (return exactly ${meshNames.length} mappings):\n${JSON.stringify(indexedMeshes, null, 2)}`;

    console.log(`[ai-smart-mesh-map] Analyzing ${meshNames.length} parts for model: ${modelName || "unknown"}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ai-smart-mesh-map] AI Gateway error ${response.status}:`, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI Gateway ${response.status}: ${errText}`);
    }

    const aiData = await response.json();
    const content = aiData.choices[0].message.content;
    let parsed;
    try { parsed = JSON.parse(content); } catch { parsed = { mappings: [] }; }

    const mappings = parsed.mappings || [];
    console.log(`[ai-smart-mesh-map] v2 - Generated ${mappings.length} mappings for ${modelName}`);

    // Save to model_mesh_mappings table using mesh index as unique key
    if (modelUrl && mappings.length > 0) {
      const rows = mappings.map((m: any, idx: number) => {
        // Use index-based key to guarantee uniqueness regardless of AI output
        const meshIndex = m.meshIndex ?? idx;
        const safeName = (m.originalMeshName || m.englishName || "part").replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 30);
        const meshKey = `mesh_${meshIndex}_${safeName}`;
        return {
          model_url: modelUrl,
          mesh_key: meshKey,
          name: m.englishName || m.hebrewName || "Unknown",
          summary: m.summary || m.functionHe || "",
          system: m.system || "מערכת לא מוגדרת",
          icon: m.icon || "🔬",
          facts: {
            displayNameHe: m.hebrewName,
            englishName: m.englishName,
            latinName: m.latinName,
            functionHe: m.functionHe,
            originalMeshName: m.originalMeshName || meshNames[meshIndex] || "",
            meshIndex: meshIndex,
            facts: [],
            factsHe: m.facts || [],
            diseases: [],
            diseasesHe: m.diseases || [],
            function: "",
          }
        };
      });

      // Delete existing mappings for this model, then insert new ones
      const { error: delError } = await supabase.from("model_mesh_mappings").delete().eq("model_url", modelUrl);
      if (delError) console.error("[ai-smart-mesh-map] Delete error:", delError);
      
      const { error } = await supabase.from("model_mesh_mappings").insert(rows);
      if (error) console.error("[ai-smart-mesh-map] Insert error:", error);
      else console.log(`[ai-smart-mesh-map] Saved ${rows.length} mappings to DB`);
    }

    return new Response(JSON.stringify({ mappings, saved: !!modelUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ai-smart-mesh-map:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
