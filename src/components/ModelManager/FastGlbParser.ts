/**
 * Fast binary GLB parser — reads mesh names directly from the GLB/glTF JSON chunk
 * without loading the full 3D scene. ~100x faster than Three.js GLTFLoader.
 *
 * GLB format: [12-byte header] [JSON chunk] [BIN chunk]
 * We only read the JSON chunk and extract mesh/node names.
 */

const GLB_MAGIC = 0x46546C67; // "glTF"
const JSON_CHUNK_TYPE = 0x4E4F534A; // "JSON"

export type FastMeshInfo = {
  meshNames: string[];
  nodeNames: string[];
  materialNames: string[];
  totalMeshes: number;
  totalNodes: number;
};

/**
 * Parse GLB from an ArrayBuffer — extracts mesh/node names from the JSON chunk only.
 * Does NOT load textures, geometry buffers or initialize WebGL.
 */
export function parseGlbFast(buffer: ArrayBuffer): FastMeshInfo {
  const view = new DataView(buffer);

  // Validate GLB header
  if (buffer.byteLength < 12) return emptyResult();
  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) return emptyResult();

  // Read JSON chunk header (starts at byte 12)
  if (buffer.byteLength < 20) return emptyResult();
  const chunkLength = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);

  if (chunkType !== JSON_CHUNK_TYPE) return emptyResult();

  // Extract JSON string
  const jsonBytes = new Uint8Array(buffer, 20, chunkLength);
  const jsonStr = new TextDecoder().decode(jsonBytes);

  let gltfJson: any;
  try {
    gltfJson = JSON.parse(jsonStr);
  } catch {
    return emptyResult();
  }

  // Extract names
  const meshNames: string[] = [];
  const nodeNames: string[] = [];
  const materialNames: string[] = [];

  if (Array.isArray(gltfJson.meshes)) {
    for (const mesh of gltfJson.meshes) {
      if (mesh.name) meshNames.push(mesh.name);
    }
  }

  if (Array.isArray(gltfJson.nodes)) {
    for (const node of gltfJson.nodes) {
      if (node.name) nodeNames.push(node.name);
    }
  }

  if (Array.isArray(gltfJson.materials)) {
    for (const mat of gltfJson.materials) {
      if (mat.name) materialNames.push(mat.name);
    }
  }

  return {
    meshNames,
    nodeNames,
    materialNames,
    totalMeshes: gltfJson.meshes?.length || 0,
    totalNodes: gltfJson.nodes?.length || 0,
  };
}

/**
 * Parse GLB from a File object.
 */
export async function parseGlbFromFile(file: File): Promise<FastMeshInfo> {
  const buffer = await file.arrayBuffer();
  return parseGlbFast(buffer);
}

/**
 * Parse GLB from a URL (fetches only the first ~512KB for the JSON chunk).
 */
export async function parseGlbFromUrl(url: string): Promise<FastMeshInfo> {
  try {
    // Try range request first — only download the JSON chunk header
    const headRes = await fetch(url, { headers: { Range: "bytes=0-524287" } });
    const buffer = await headRes.arrayBuffer();
    return parseGlbFast(buffer);
  } catch {
    // Fallback: download entire file
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    return parseGlbFast(buffer);
  }
}

function emptyResult(): FastMeshInfo {
  return { meshNames: [], nodeNames: [], materialNames: [], totalMeshes: 0, totalNodes: 0 };
}
