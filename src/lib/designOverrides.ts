export type OverrideScope = "element" | "class" | "global";

export type DesignOverride = {
  id: string;
  scope: OverrideScope;
  selector: string;
  label: string;
  css: Record<string, string>;
  createdAt: number;
};

export const DESIGN_OVERRIDES_KEY = "design_overrides_v1";
export const DESIGN_OVERRIDES_STYLE_ID = "design-mode-overrides";

const escapeCss = (value: string) => typeof CSS !== "undefined" && CSS.escape ? CSS.escape(value) : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");

export function computeSelector(element: Element) {
  if (element.id) return `#${escapeCss(element.id)}`;
  const testId = element.getAttribute("data-testid");
  if (testId) return `[data-testid="${testId.replace(/"/g, '\\"')}"]`;
  const parts: string[] = [];
  let current: Element | null = element;
  for (let depth = 0; current && current !== document.body && depth < 7; depth += 1) {
    if (current.id) { parts.unshift(`#${escapeCss(current.id)}`); break; }
    const parent: Element | null = current.parentElement;
    if (!parent) break;
    const index = Array.from(parent.children).indexOf(current) + 1;
    parts.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`);
    current = parent;
  }
  return parts.join(" > ");
}

export function computeClassSelector(element: Element) {
  const classes = (element.getAttribute("class") || "").split(/\s+/).filter(Boolean)
    .filter((name) => !name.includes(":") && name.length < 48).slice(0, 6);
  return `${element.tagName.toLowerCase()}${classes.map((name) => `.${escapeCss(name)}`).join("")}`;
}

const semanticTags = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "button", "a", "label", "input", "textarea", "select", "article", "section", "aside", "header", "footer", "li"]);
export function computeGlobalSelector(element: Element) {
  const tag = element.tagName.toLowerCase();
  return semanticTags.has(tag) ? tag : computeClassSelector(element);
}

export function describeElement(element: Element) {
  const text = (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34);
  const identity = element.id ? `#${element.id}` : (element.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 2).map((item) => `.${item}`).join("");
  return `${element.tagName.toLowerCase()}${identity}${text ? ` · ${text}` : ""}`;
}

export function loadDesignOverrides(): DesignOverride[] {
  try { return JSON.parse(localStorage.getItem(DESIGN_OVERRIDES_KEY) || "[]") as DesignOverride[]; }
  catch { return []; }
}

export function applyDesignOverrides(items: DesignOverride[]) {
  let style = document.getElementById(DESIGN_OVERRIDES_STYLE_ID) as HTMLStyleElement | null;
  if (!style) { style = document.createElement("style"); style.id = DESIGN_OVERRIDES_STYLE_ID; document.head.appendChild(style); }
  style.textContent = items.map((item) => `${item.selector}{${Object.entries(item.css).map(([key, value]) => `${key}:${value}!important`).join(";")}}`).join("\n");
}

export function saveDesignOverrides(items: DesignOverride[]) {
  localStorage.setItem(DESIGN_OVERRIDES_KEY, JSON.stringify(items));
  applyDesignOverrides(items);
}
