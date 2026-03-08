import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Lightweight edge function: resolves Sketchfab download URL only.
 * The browser then downloads the GLB directly and uploads to Storage,
 * completely bypassing edge function memory limits.
 *
 * POST body: { uid: string, sketchfabToken: string }
 * Returns:   { glbUrl: string, fileName: string }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { uid, sketchfabToken } = await req.json();
    if (!uid || !sketchfabToken) {
      return new Response(
        JSON.stringify({ error: "Missing uid or sketchfabToken" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve the download URL from Sketchfab API (requires token, can't do from browser due to CORS)
    console.log(`[get-url] Resolving download URL for ${uid}...`);
    const dlRes = await fetch(
      `https://api.sketchfab.com/v3/models/${uid}/download`,
      { headers: { Authorization: `Token ${sketchfabToken}` } },
    );

    if (!dlRes.ok) {
      const errText = await dlRes.text();
      return new Response(
        JSON.stringify({ error: `Sketchfab API ${dlRes.status}: ${errText.substring(0, 200)}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const dlPayload = await dlRes.json();

    // Recursively find download URLs
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
      return new Response(
        JSON.stringify({ error: "No GLB download URL found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[get-url] ✅ Resolved URL for ${uid}`);

    return new Response(
      JSON.stringify({ glbUrl, fileName: `sketchfab_${uid}.glb` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[get-url] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
