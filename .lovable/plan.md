

## Investigation Results — Thorough Database & Storage Audit

### What's Actually in the Backend

| Resource | Count |
|----------|-------|
| **Models in DB** (`models` table) | **37** |
| **Files in Storage** (`models` bucket) | **88** (includes duplicates from earlier client-side attempts + thumbnails) |
| **Models with mesh_parts** | **8** (all from older uploads on March 4-6, none from recent Sketchfab imports) |
| **Models with thumbnails** | **0** |

### Category Distribution
- **No category (null)**: 26 models
- **Category `4d32a469...`**: 9 models
- **Category `5864a3a6...`**: 2 models

### Root Cause: "Only 6 Models Showing"

The UI filters by **active category**. If a category tab is selected, only models with that `category_id` are shown. The **7 newest Sketchfab imports all have `category_id = NULL`** because the Edge Function doesn't assign a category. So if a category filter is active, these imports are hidden.

### Root Cause: "Analysis Not Running"

The background analysis code (lines 511-564) runs correctly in structure, but:
1. **No console logs captured** — the background `fetch()` of the GLB from storage likely fails silently due to the browser context (the user may navigate away, or the async task gets garbage collected).
2. **All 7 recent Sketchfab imports have `mesh_parts: []`** — confirms the background analysis never completes.
3. **Zero thumbnails exist** — confirms thumbnail generation also never completes.

The issue is that the background IIFE fires after `await load()` which re-renders the component. The `fetch(result.fileUrl)` for a multi-MB GLB file in the browser is unreliable for background processing.

### Root Cause: "No Thumbnails"

The auto-thumbnail `useEffect` (line 166) should catch this, but it uses `generateThumbnailFromUrl` which creates a full Three.js renderer per model — this is very slow and may crash/timeout in the browser for many models at once.

---

## Plan

### 1. Fix Category Assignment on Sketchfab Import
- In `handleImportSketchfab`, pass `activeCategory || categories[0]?.id || null` to the Edge Function
- Update the Edge Function to accept and save `category_id`

### 2. Move Analysis to the Edge Function (Server-Side)
Instead of downloading the GLB again in the browser for analysis, do the mesh extraction **inside the Edge Function** itself (it already has the GLB bytes). The Edge Function already has GLB parsing logic in `analyze-glb` — merge that logic into `import-sketchfab-model`:
- After downloading the GLB, parse the JSON chunk to extract mesh names
- Save `mesh_parts` directly during the insert/update
- This eliminates the unreliable browser-side background fetch entirely

### 3. Move Thumbnail to a Dedicated Edge Function (or Keep Client-Side but Fix)
Thumbnail generation requires Three.js rendering which can't run server-side. Fix the client-side approach:
- After the Edge Function returns with `modelId`, trigger thumbnail generation using the already-known `fileUrl` directly (no re-fetch needed — use `generateThumbnailFromUrl` with the public URL)
- Ensure this runs even if the user navigates away by keeping it in a stable ref

### 4. Show All Models Regardless of Category Filter
- Add an "All" tab (or ensure null category shows everything), which is the default
- Make sure the count badge shows the true total (37)

### Technical Changes

**`supabase/functions/import-sketchfab-model/index.ts`**:
- Add `category_id` parameter
- After downloading the GLB `arrayBuffer`, parse the GLB JSON chunk inline (same logic as `analyze-glb`) to extract mesh names
- Save `mesh_parts` and `category_id` in the insert/update

**`src/components/ModelManager/index.tsx`**:
- Pass `categoryId` in the Edge Function request body
- Remove the heavy background GLB re-download for analysis (server now handles it)
- Keep only thumbnail generation as background (using the public URL, no re-fetch of bytes)
- Ensure "all models" tab is default and visible

This approach means every Sketchfab import will immediately have mesh_parts populated and a category assigned, with thumbnails generated client-side after.

