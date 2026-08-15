export type AnatomyBounds = {
  center: [number, number, number];
  size: [number, number, number];
};

/**
 * Calculates an aspect-fit distance for a perspective camera. Both the
 * vertical and horizontal field of view are respected so a tall head, a wide
 * pelvis, or a long bone stays fully inside the available viewport.
 */
export function anatomyFitDistance(
  bounds: AnatomyBounds,
  verticalFovDegrees: number,
  aspect: number,
  padding = 1.35,
): number {
  const safeAspect = Math.max(aspect, 0.1);
  const verticalFov = Math.max(1, Math.min(179, verticalFovDegrees)) * Math.PI / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * safeAspect);
  const [width, height, depth] = bounds.size.map(value => Math.max(Math.abs(value), 0.001)) as [number, number, number];
  const distanceForWidth = width / (2 * Math.tan(horizontalFov / 2));
  const distanceForHeight = height / (2 * Math.tan(verticalFov / 2));
  return Math.max(0.35, Math.max(distanceForWidth, distanceForHeight) * Math.max(padding, 1) + depth / 2);
}
