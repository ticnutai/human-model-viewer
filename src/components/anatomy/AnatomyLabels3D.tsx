/**
 * AnatomyLabels3D — floating 3D text labels for organs using drei's <Html>.
 * Labels point to organ positions with a thin leader line.
 * Place inside <Canvas>.
 */
import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { ORGAN_DETAILS, getLocalizedOrganName } from "../OrganData";
import type { OrganDetail } from "../OrganData";

interface Label {
  key: string;
  position: [number, number, number];
  name: string;
  icon: string;
}

// Organ label positions — we use canonical positions for major organs
const LABEL_POSITIONS: { key: string; position: [number, number, number] }[] = [
  { key: "brain", position: [0, 2.08, 0.02] },
  { key: "heart", position: [0.06, 0.78, 0.06] },
  { key: "lung", position: [0.22, 0.88, 0.01] },
  { key: "liver", position: [-0.16, 0.36, 0.04] },
  { key: "stomach", position: [0.12, 0.3, 0.06] },
  { key: "kidney", position: [0.16, 0.1, -0.08] },
  { key: "spleen", position: [0.32, 0.32, -0.04] },
  { key: "pancreas", position: [0, 0.2, -0.01] },
  { key: "bladder", position: [0, -0.42, 0.06] },
  { key: "colon", position: [0.22, -0.08, 0.02] },
  { key: "intestine", position: [0, -0.12, 0.04] },
  { key: "diaphragm", position: [0, 0.5, 0] },
  { key: "aorta", position: [0.03, 0.55, -0.02] },
];

type AppLanguage = "he" | "en" | "ar";

interface AnatomyLabelsProps {
  enabled: boolean;
  lang: AppLanguage;
  accent?: string;
  selectedKey?: string | null;
  /** Extra offset for exploded view */
  yOffset?: number;
  explodeAmount?: number;
  onSelect?: (detail: OrganDetail) => void;
}

export default function AnatomyLabels3D({
  enabled,
  lang,
  accent = "#0077b6",
  selectedKey = null,
  yOffset = 0,
  explodeAmount = 0,
  onSelect,
}: AnatomyLabelsProps) {
  const labels: Label[] = useMemo(() => {
    return LABEL_POSITIONS.map((lp) => {
      const organ = ORGAN_DETAILS[lp.key];
      if (!organ) return null;
      return {
        key: lp.key,
        position: lp.position,
        name: getLocalizedOrganName(lp.key, organ.name, lang),
        icon: organ.icon,
      };
    }).filter(Boolean) as Label[];
  }, [lang]);

  if (!enabled) return null;

  return (
    <group position={[0, -0.5 + yOffset, 0]}>
      {labels.map((label) => {
        const isSelected = label.key === selectedKey;
        const explodeSignX = label.position[0] === 0 ? 0 : Math.sign(label.position[0]);
        const labelY = label.position[1] + 0.2 + explodeAmount * (label.position[1] > 0 ? 0.08 : 0.04);
        const labelX = (label.position[0] > 0 ? label.position[0] + 0.35 : label.position[0] - 0.35) + explodeSignX * explodeAmount * 0.18;
        const labelZ = label.position[2] + 0.15 + explodeAmount * 0.06;
        const organ = ORGAN_DETAILS[label.key];

        return (
          <group key={label.key}>
            {/* Leader line from organ to label */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[
                    new Float32Array([
                      label.position[0], label.position[1], label.position[2],
                      labelX, labelY, labelZ,
                    ]),
                    3,
                  ]}
                  count={2}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial
                color={isSelected ? accent : "#888888"}
                transparent
                opacity={isSelected ? 0.8 : 0.35}
                linewidth={1}
              />
            </line>

            {/* Small dot at organ position */}
            <mesh position={label.position}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshBasicMaterial color={isSelected ? accent : "#aaaaaa"} />
            </mesh>
            <mesh position={label.position}>
              <ringGeometry args={[0.02, 0.028, 24]} />
              <meshBasicMaterial color={isSelected ? accent : "#d1d5db"} transparent opacity={isSelected ? 0.8 : 0.35} />
            </mesh>

            {/* HTML label */}
            <Html
              position={[labelX, labelY, labelZ]}
              center
              occlude
              style={{ pointerEvents: onSelect ? "auto" : "none" }}
            >
              <div
                onClick={() => organ && onSelect?.({ ...organ, meshName: label.key })}
                style={{
                  background: isSelected
                    ? `linear-gradient(135deg, ${accent}ee, ${accent}bb)`
                    : "rgba(0,0,0,0.65)",
                  backdropFilter: "blur(6px)",
                  color: "#fff",
                  padding: "3px 10px",
                  borderRadius: "8px",
                  fontSize: "10px",
                  fontWeight: isSelected ? 800 : 600,
                  whiteSpace: "nowrap",
                  border: `1px solid ${isSelected ? accent : "rgba(255,255,255,0.15)"}`,
                  boxShadow: isSelected
                    ? `0 2px 12px ${accent}40`
                    : "0 2px 8px rgba(0,0,0,0.2)",
                  direction: "rtl",
                  opacity: isSelected ? 1 : 0.7,
                  transform: isSelected ? "scale(1.15)" : "scale(1)",
                  transition: "all 0.3s ease",
                  cursor: onSelect ? "pointer" : "default",
                }}
              >
                {label.icon} {label.name}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
