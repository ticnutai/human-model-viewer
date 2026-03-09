import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meshNames, modelName, hebrewName, partsCount } = await req.json();

    if (!Array.isArray(meshNames) || meshNames.length === 0) {
      return new Response(JSON.stringify({ error: "meshNames array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build context-aware prompt
    const contextInfo = [
      modelName ? `Model name: "${modelName}"` : "",
      hebrewName ? `Hebrew name: "${hebrewName}"` : "",
      `Total mesh parts: ${partsCount || meshNames.length}`,
    ].filter(Boolean).join("\n");

    const systemPrompt = `You are an expert anatomist specializing in 3D medical models. 
You are given a list of mesh part names from a 3D anatomical model, along with context about what the model represents.

Your task:
1. Based on the MODEL NAME and the NUMBER OF PARTS, deduce which anatomical structures each mesh part likely represents.
2. For generic names like "Object_0", "Object_1" etc., use the model context to make educated guesses about what each part is.
3. Return results in Hebrew.

Rules:
- If the model is "Heart Anatomy" with 6 parts, those parts are likely: חדר שמאלי, חדר ימני, עלייה שמאלית, עלייה ימינית, אבי העורקים, וריד הריאה
- If the model is "Brain" with 15 parts, those are likely brain regions: אונה קדמית, אונה רקתית, גזע המוח, מוחון, etc.
- If you cannot determine the specific structure, provide a reasonable anatomical label based on context.
- Always return Hebrew names.

Return ONLY a valid JSON object: {"results": [{"meshName": "original_name", "hebrewName": "שם בעברית", "system": "מערכת גוף"}]}`;

    const userPrompt = `${contextInfo}

Mesh part names to identify:
${JSON.stringify(meshNames)}`;

    console.log(`[ai-analyze-mesh] Analyzing ${meshNames.length} parts for model: ${modelName || "unknown"}`);

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
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("AI Gateway error:", response.status, errorData);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI Gateway returned ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      parsed = { results: [] };
    }

    console.log(`[ai-analyze-mesh] Identified ${parsed.results?.length || 0} structures`);

    return new Response(JSON.stringify({ results: parsed.results || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in ai-analyze-mesh:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
