# Product unification map

## One product, three work modes

1. Atlas and learning: focused organ exploration, guided journeys, quizzes, and the smart guide.
2. Body builder: shared HRA coordinates, multi-organ layers, and locally imported organs.
3. 3D studio: model library, gallery, mesh mapping, analysis, effects, and advanced inspection.

All modes share the global desktop navigation, the canonical HRA catalog, and the cloud model repository.

## Consolidated now

- `humanAtlasCatalog.ts` is the single source for 13 HRA organs. The learning atlas and body builder are projections of it.
- `cloudModelRepository.ts` is the single read gateway for Supabase models and categories.
- Desktop system shortcuts and legacy panel tabs live in the global sidebar, not duplicated headers.
- Advanced HRA brain, kidney, liver, and lung entries use the same local curated files as the atlas.

## Capabilities intentionally preserved during migration

The `/advanced` route is now a compatibility redirect to the advanced-effects panel inside the unified 3D studio. Smart AI mesh mapping and mapping deletion are available through the studio analysis and mapping tools.

The legacy studio also retains capabilities that do not exist in `/advanced`: comparison, pathology search, performance monitor, screenshot, GLB import, gallery, batch analysis, and mapping management.

X-ray color/intensity, inverted clipping direction, heartbeat/breathing/digestion controls, scene brightness and themes, cloud-model favorites, pins, rename, duplicate cleanup, and deletion have now migrated into the studio and are no longer blockers for retiring `/advanced`.

## Do not merge visually

- Single-organ learning catalog and multi-organ body layers share data but remain separate work panels.
- End-user learning tools and database/developer administration remain separate permission surfaces.
- Normalized single-organ framing and HRA shared body coordinates remain separate scene presets.

## Legacy source retirement

`AdvancedAnatomyViewer.tsx` is no longer loaded by a public route. Keep the source temporarily for implementation comparison; delete it only after a later cleanup PR confirms no imports and completes a production bundle comparison.
