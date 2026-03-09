import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { meshNames } = await req.json();

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

    // Call Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an expert anatomist. Analyze the provided list of 3D mesh names from a medical model. Identify the actual human organs or structures they represent. Return ONLY a valid JSON object with a single property 'results' containing an array of identified anatomical structures in Hebrew. Example: {\"results\": [\"לב\", \"ריאה ימנית\", \"אבי העורקים\"]}"
          },
          {
            role: "user",
            content: `Mesh names: ${JSON.stringify(meshNames)}`
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("AI Gateway error:", errorData);
      throw new Error(`AI Gateway returned ${response.status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      parsed = { results: [] };
    }

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
