export type AnatomySourceKey =
  | "open_anatomy"
  | "bodyparts3d"
  | "nih_3d"
  | "slicer"
  | "mmhuman3d"
  | "xeokit"
  | "biodigital";

export type RiskLevel = "low" | "medium" | "high";

export type AnatomySourceProfile = {
  key: AnatomySourceKey;
  name: string;
  category: "atlas" | "model-library" | "tooling" | "sdk" | "commercial-api";
  primaryUse: string;
  strengths: string[];
  constraints: string[];
  licenseSummary: string;
  commercialFriendly: boolean;
  openSource: boolean;
  riskLevel: RiskLevel;
  links: {
    home: string;
    docs?: string;
    license?: string;
  };
};

export const ANATOMY_SOURCE_CATALOG: AnatomySourceProfile[] = [
  {
    key: "open_anatomy",
    name: "Open Anatomy Project",
    category: "atlas",
    primaryUse: "Open atlas architecture, JSON-LD style semantic atlas references, collaborative anatomy publishing",
    strengths: [
      "Strong open-atlas vision and reusable layered architecture",
      "Atlas model focused on annotations, linking and extensibility",
      "Natural fit for multilingual educational experiences"
    ],
    constraints: [
      "Project is described as prototype/proof-of-concept in FAQ",
      "Per-atlas data licensing may vary and must be checked item-by-item",
      "No guaranteed production-grade API SLA"
    ],
    licenseSummary: "Open and free mission, but each atlas/data artifact should be individually license-verified before production use.",
    commercialFriendly: true,
    openSource: true,
    riskLevel: "medium",
    links: {
      home: "https://www.openanatomy.org/",
      docs: "https://www.openanatomy.org/technology.html"
    }
  },
  {
    key: "bodyparts3d",
    name: "BodyParts3D",
    category: "model-library",
    primaryUse: "Anatomical components aligned with FMA concepts for fine-grained structure mapping",
    strengths: [
      "Very detailed part hierarchy and concept mapping",
      "Useful for sub-structure labels and annotation systems",
      "Mature atlas-style segmentation taxonomy"
    ],
    constraints: [
      "Dataset/version conventions are domain-specific and require preprocessing",
      "Historical web interface and data workflow may need conversion",
      "License attribution/share-alike obligations apply"
    ],
    licenseSummary: "Published under Creative Commons BY-SA 2.1 JP (as presented on BodyParts3D portal).",
    commercialFriendly: true,
    openSource: true,
    riskLevel: "medium",
    links: {
      home: "https://lifesciencedb.jp/bp3d/",
      license: "https://creativecommons.org/licenses/by-sa/2.1/jp/"
    }
  },
  {
    key: "nih_3d",
    name: "NIH 3D Model Library",
    category: "model-library",
    primaryUse: "Large community-driven biomedical 3D asset repository",
    strengths: [
      "Large and actively growing model catalog",
      "Good source for educational and scientific visualization assets",
      "Terms explicitly discuss model-level licensing differences"
    ],
    constraints: [
      "License is per-entry and not globally uniform",
      "Not intended as medical diagnostic tool",
      "IP and endorsement limitations in NIH terms"
    ],
    licenseSummary: "Many entries are public domain/CC, but each model must be individually reviewed under its specific listed license.",
    commercialFriendly: true,
    openSource: true,
    riskLevel: "medium",
    links: {
      home: "https://3d.nih.gov/",
      license: "https://3d.nih.gov/terms"
    }
  },
  {
    key: "slicer",
    name: "3D Slicer",
    category: "tooling",
    primaryUse: "Authoring pipeline: segmentation, mesh cleanup, registration, export",
    strengths: [
      "Powerful end-to-end medical imaging workflow",
      "BSD-style licensing and commercial use support",
      "Large ecosystem of extensions and Python automation"
    ],
    constraints: [
      "Desktop workflow, not directly embeddable in web app runtime",
      "Needs pipeline engineering for export automation",
      "Clinical use and compliance remain your responsibility"
    ],
    licenseSummary: "BSD-style Slicer license; broad use including commercial workflows according to project docs.",
    commercialFriendly: true,
    openSource: true,
    riskLevel: "low",
    links: {
      home: "https://www.slicer.org/",
      docs: "https://slicer.readthedocs.io/",
      license: "https://slicer.readthedocs.io/en/latest/user_guide/about.html#license"
    }
  },
  {
    key: "mmhuman3d",
    name: "MMHuman3D",
    category: "tooling",
    primaryUse: "Parametric human body model research (SMPL/SMPL-X pipelines)",
    strengths: [
      "Strong research framework for parametric body modeling",
      "Apache-2.0 core framework",
      "Useful for synthetic data and body-shape procedural workflows"
    ],
    constraints: [
      "Includes dependencies/models with additional restrictive licenses",
      "Some model families are non-commercial unless separately licensed",
      "Not an out-of-the-box anatomy education atlas"
    ],
    licenseSummary: "Core is Apache-2.0, but additional model/method licenses (e.g., SMPL family) may be non-commercial and restrictive.",
    commercialFriendly: false,
    openSource: true,
    riskLevel: "high",
    links: {
      home: "https://github.com/open-mmlab/mmhuman3d",
      license: "https://github.com/open-mmlab/mmhuman3d/blob/main/docs/additional_licenses.md"
    }
  },
  {
    key: "xeokit",
    name: "xeokit SDK",
    category: "sdk",
    primaryUse: "High-performance web 3D viewer framework with plugin architecture",
    strengths: [
      "Fast rendering and rich plugin system",
      "Good for annotations, measurements and heavy scenes",
      "Supports self-hosted architecture"
    ],
    constraints: [
      "Primary focus is BIM/AEC rather than anatomy",
      "Open option is AGPL-3.0 with copyleft implications",
      "Proprietary commercial license may be needed for closed-source products"
    ],
    licenseSummary: "Open-source AGPL-3.0 option and separate proprietary license option.",
    commercialFriendly: true,
    openSource: true,
    riskLevel: "high",
    links: {
      home: "https://xeokit.io/",
      license: "https://xeokit.io/"
    }
  },
  {
    key: "biodigital",
    name: "BioDigital",
    category: "commercial-api",
    primaryUse: "Commercial-ready 3D anatomy platform and embeddable experiences",
    strengths: [
      "Ready content and tooling for rapid deployment",
      "Business support and API ecosystem",
      "Strong fit for enterprise health education products"
    ],
    constraints: [
      "Commercial terms and content controls",
      "Not open-source",
      "Usage constraints and platform dependence"
    ],
    licenseSummary: "Commercial platform under BioDigital terms; content copying/distribution restrictions apply unless licensed.",
    commercialFriendly: true,
    openSource: false,
    riskLevel: "high",
    links: {
      home: "https://www.biodigital.com/",
      license: "https://www.biodigital.com/terms"
    }
  }
];

export type UpgradeStrategy = {
  source: AnatomySourceProfile;
  score: number;
  fitReason: string;
};

export function rankSourcesForEducationalWebStack() {
  return ANATOMY_SOURCE_CATALOG.map<UpgradeStrategy>((source) => {
    let score = 0;
    if (source.openSource) score += 30;
    if (source.commercialFriendly) score += 20;
    if (source.category === "tooling") score += 20;
    if (source.category === "atlas" || source.category === "model-library") score += 20;
    if (source.riskLevel === "low") score += 20;
    if (source.riskLevel === "medium") score += 8;
    if (source.riskLevel === "high") score -= 12;

    const fitReason =
      source.key === "slicer"
        ? "Best pipeline backbone for creating production-quality assets"
        : source.key === "nih_3d"
          ? "Best breadth for model acquisition with per-asset license checks"
          : source.key === "open_anatomy"
            ? "Best semantic atlas direction for multilingual educational architecture"
            : source.key === "bodyparts3d"
              ? "Best fine-grained structure source for annotation detail"
              : source.key === "mmhuman3d"
                ? "Best for R&D/procedural body generation, not direct atlas content"
                : source.key === "xeokit"
                  ? "Best viewer-performance option with careful AGPL/commercial decision"
                  : "Fastest commercial route with licensing and platform lock-in tradeoff";

    return { source, score, fitReason };
  }).sort((a, b) => b.score - a.score);
}

export function getLicenseGatingChecklist(source: AnatomySourceProfile): string[] {
  const common = [
    "Verify exact license on each model/asset before importing",
    "Store license metadata and attribution alongside model records",
    "Track commercial-use permissions per asset",
    "Automate a pre-publish compliance check in CI"
  ];

  if (source.key === "mmhuman3d") {
    return [
      ...common,
      "Validate additional licenses for SMPL/SMPL-X/VIBE/PARE/STAR components",
      "Block production export for non-commercial-only assets"
    ];
  }

  if (source.key === "xeokit") {
    return [
      ...common,
      "Decide AGPL compliance path vs proprietary license before shipping closed-source code"
    ];
  }

  if (source.key === "nih_3d") {
    return [
      ...common,
      "Treat each entry as independently licensed (public domain/CC/other)",
      "Keep per-file license evidence in source manifest"
    ];
  }

  if (source.key === "biodigital") {
    return [
      ...common,
      "Ensure embedding/distribution terms are covered in contract",
      "Avoid exporting/rehosting restricted proprietary assets"
    ];
  }

  return common;
}
