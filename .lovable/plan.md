

## Analysis

The issue is clear from the code: **edit (✏️) and delete (🗑️) buttons only appear for cloud models** (`model.source === "cloud"`). Local models from the manifest get no action buttons at all. Additionally, the buttons are tiny (11px) and easy to miss.

From the screenshot, most visible cards appear to be local models (📂 badge), which is why no edit/delete/play buttons are showing.

## Plan

### 1. Show action buttons on ALL model cards (not just cloud)

**File: `src/components/ModelManager/ModelCard.tsx`**

- Remove the `model.source === "cloud" && rec &&` condition from the edit/delete/play button rendering in the grid view (lines 131-155)
- For local models: delete will remove from view (or hide), edit will allow renaming the display name
- For cloud models: keep existing delete (from DB + storage) and edit behavior
- Make buttons bigger (14-16px instead of 11px) with better contrast and always visible (not just on hover)

### 2. Improve card action bar visibility

- Add a visible action bar at the bottom of each grid card with clear icon buttons
- Use a light background strip so buttons stand out
- Add tooltip-style titles in Hebrew

### 3. Add thumbnail preview on click

- Add a small "eye" (👁️) button that expands the thumbnail or triggers model preview
- For models without thumbnails, show a "generate thumbnail" button more prominently

### 4. Local model actions

- **Delete local**: Filter it out from the local list (stored in state/localStorage)
- **Edit local**: Allow inline name editing (stored in localStorage for persistence)
- **Play**: Already works via `onSelect`

### Colors
- White background, navy text (`hsl(220 40% 13%)`), gold borders (`hsl(43 78% 47%)`) per existing theme

