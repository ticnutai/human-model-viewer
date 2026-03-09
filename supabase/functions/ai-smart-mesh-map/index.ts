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

    const contextInfo = [
      modelName ? `Model: "${modelName}"` : "",
      hebrewName ? `Hebrew: "${hebrewName}"` : "",
      `Parts count: ${meshNames.length}`,
    ].filter(Boolean).join("\n");

    const systemPrompt = `You are an expert anatomist. Given mesh part names from a 3D anatomical model, create DETAILED anatomical information cards for each part.

For each mesh part, provide:
1. hebrewName - Hebrew anatomical name
2. englishName - English anatomical name
3. latinName - Latin anatomical name
4. system - Body system in Hebrew (e.g. "מערכת לב וכלי דם", "מערכת השלד", "מערכת השרירים", "מערכת העיכול", "מערכת הנשימה", "מערכת העצבים")
5. icon - Single emoji representing the structure
6. summary - One sentence description in Hebrew
7. functionHe - Function description in Hebrew
8. facts - Array of 2-3 interesting facts in Hebrew
9. diseases - Array of 2-3 related diseases in Hebrew

Context:
${contextInfo}

Return ONLY valid JSON: {"mappings": [...]}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Mesh parts to map:\n${JSON.stringify(meshNames)}` }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
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
    console.log(`[ai-smart-mesh-map] Generated ${mappings.length} mappings for ${modelName}`);

    // Save to model_mesh_mappings table
    if (modelUrl && mappings.length > 0) {
      const rows = mappings.map((m: any) => ({
        model_url: modelUrl,
        mesh_key: m.meshName || m.englishName || "unknown",
        name: m.englishName || m.hebrewName || "Unknown",
        summary: m.summary || m.functionHe || "",
        system: m.system || "מערכת לא מוגדרת",
        icon: m.icon || "🔬",
        facts: {
          displayNameHe: m.hebrewName,
          latinName: m.latinName,
          functionHe: m.functionHe,
          facts: [],
          factsHe: m.facts || [],
          diseases: [],
          diseasesHe: m.diseases || [],
          function: "",
        }
      }));

      // Upsert (delete existing + insert new)
      await supabase.from("model_mesh_mappings").delete().eq("model_url", modelUrl);
      const { error } = await supabase.from("model_mesh_mappings").insert(rows);
      if (error) console.error("[ai-smart-mesh-map] DB error:", error);
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
