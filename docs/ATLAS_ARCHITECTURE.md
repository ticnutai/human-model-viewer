# Professional anatomy atlas architecture

## Product decision

The public experience uses coherent, semantically separated GLB organs from the HuBMAP Human Reference Atlas. The old procedural body remains available only at `/legacy`; it is not a production-quality anatomy source.

## Asset gates

Every production asset must have:

- source URL, creator attribution, license URL, and UBERON identifier;
- a license that permits the intended public use;
- multiple named meshes/nodes so structures can be selected and isolated;
- a delivery size below 15 MB per organ before exceptional review;
- successful GLB v2 parsing and browser loading.

Run `npm run atlas:validate` and `npm run compliance:check` before release.

## Runtime strategy

- WebGL2 remains the stable baseline. WebGPU can be evaluated behind a capability flag after its material and browser compatibility are proven.
- Only the default heart is prefetched. Other organs load on demand and are cached by `useGLTF`.
- Device pixel ratio is capped at 1.5 for predictable GPU load.
- Each organ is an independent chunk, so the visitor never downloads the entire atlas.
- Selection works at mesh level; opacity and exploded-view transforms preserve the original scene hierarchy.

## Next asset pipeline milestone

For a whole-body atlas, import a single licensed source such as Z-Anatomy/BodyParts3D into an offline conversion pipeline. Normalize names to UBERON/FMA, remove nonessential geometry, generate LODs, compress geometry with Meshopt, encode textures as KTX2, then publish modular system/region chunks. Do not mix unrelated marketplace models into one body.

## Release quality bar

TypeScript, unit tests, production build, license checks, atlas validation, and Playwright tests on desktop and mobile must pass. Browser QA collects page errors and failed model requests in an isolated headless context.

## Smart guide

The guide receives explicit scene context (organ, selected structure, opacity, exploded state, simulation, and learning level) and may return only allow-listed scene actions. Its local engine works offline in Hebrew. A generative provider can be added through `VITE_SMART_GUIDE_ENDPOINT`; that endpoint must run on a trusted server, keep provider secrets outside the browser, ground answers in HRA data, validate tool arguments, and return the same `GuideReply` contract.

Learning level and aggregate progress are stored locally in the browser by default. Voice input uses the browser speech-recognition capability when available, with typed input as the stable fallback.

## Body assembly

`/body-builder` composes 13 male HRA reference organs without centering or resizing each asset independently. Their source transforms are preserved so they remain in the shared reference-body coordinate system. The layer panel controls selection, visibility and global opacity. User-supplied GLBs are validated by their binary header and stored locally in IndexedDB together with explicit X/Y/Z placement and scale; their anatomical accuracy and license remain the importer’s responsibility.

The cloud/local GLB manager is available at `/legacy?panel=models&tool=models`; its mapping tools use the same studio panel with `tool=meshmap` and `tool=allmappings`.
