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

`/body-builder` catalogs 23 male HRA reference layers without centering or resizing each asset independently. Their source transforms are preserved so they remain in the shared reference-body coordinate system. Thirteen core organs form the lightweight initial preset; blood vasculature, larynx, bronchi, ureters, pelvis, prostate, skin, thymus and lymph node load only when revealed. The panel groups layers by anatomical system, provides core/full/shell presets, and persists visibility choices locally. User-supplied GLBs are validated by their binary header and stored locally in IndexedDB together with explicit X/Y/Z placement and scale; their anatomical accuracy and license remain the importer’s responsibility.

The same studio includes a separate 28-layer female HRA body. It uses only female Visible Human coordinates and adds the uterus, ovaries, fallopian tubes, left mammary gland and placenta. Male and female objects are never mixed in a single reference assembly. The female lung and right mammary gland currently remain outside the live catalog because their official GLBs exceed the 15 MB delivery gate.

The official HRA eye objects are excluded until they are optimized below the 15 MB per-asset delivery gate. The male/female skin shells and the two single-mesh ovaries are documented semantic-separation exceptions.

## Medical media lab

`/media-lab` is Hebrew-first and serves local public-domain sample media from the U.S. National Library of Medicine Visible Human Project. It compares real-color cryosections with T1, T2 and proton-density MRI samples across six body regions. A timed sequence is an interactive slice tour, not a diagnostic cine study. The multiscale view connects body, organ, tissue, cell and physiological process with vetted Hebrew educational copy. Source, dignity statement and educational disclaimer remain visible in the interface.

The cloud/local GLB manager is available at `/legacy?panel=models&tool=models`; its mapping tools use the same studio panel with `tool=meshmap` and `tool=allmappings`.
