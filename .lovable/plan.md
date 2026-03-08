

## Plan: Search/Filter for Body Model Picker + Import New Models

### 1. Replace `<select>` with Searchable Combobox
**Current state**: The body model picker at line 571-593 in `ModelViewer.tsx` is a plain `<select>` dropdown with ~20+ options (cloud + local). Hard to navigate.

**Change**: Replace with a custom searchable dropdown component:
- Text input with filter functionality (searches display_name, hebrew_name)
- Grouped results: Cloud Models / Local Models
- Clicking outside closes the dropdown
- Selected model shown as text in the input
- Compact styling matching existing panel (10px text, dark theme compatible)

**File**: `src/components/ModelViewer.tsx` (lines 566-594)

### 2. Import New Models to Cloud Storage

Import these models via the `import-sketchfab-model` edge function. This requires a Sketchfab API token from the user.

**Models to import**:
- **Chest/Thorax**: `a8c1612518af4bfe88e1c0a719bec463` — "Human Thorax: Heart & Kidney" (detailed chest cavity)
- **Heart detailed**: `3f8072336ce94d18b3d0d055a1ece089` — "Realistic Human Heart" (already local, upload to cloud)
- **Original local models** that are currently LFS pointers — upload working copies to cloud:
  - `front-body-anatomy` 
  - `human-anatomy` (faf0f3eaec554bcf854be2038993024f)
  - `human-anatomy-male-torso`
  - `human-anatomy-heart-in-thorax`
  - `male-body-muscular-system`
  - `female-body-muscular-system`
  - `male-human-skeleton`
  - `female-human-skeleton`

For the Sketchfab imports, we need the user's Sketchfab API token. The local models that are LFS pointers cannot be uploaded (they're not real GLB data) — we'd need to re-download them from Sketchfab.

**Approach**: 
- Call the existing `import-sketchfab-model` edge function for each new model UID
- Update the `models` table with Hebrew names after import
- The searchable picker will automatically show new models

### 3. Update Local Models List
Remove local model options that are LFS pointers (won't load anyway). Keep only models that have working cloud URLs. The cloud models list from the database will be the primary source.

### Technical Summary
- **Files modified**: `src/components/ModelViewer.tsx`
- **Edge function calls**: `import-sketchfab-model` for new Sketchfab models
- **DB updates**: Hebrew names for newly imported models
- **Prerequisite**: User must provide Sketchfab API token (was previously requested but need to confirm it's stored as a secret)

