import { readFileSync, writeFileSync } from "fs";
const code = readFileSync("src/components/OrganData.ts", "utf8");
const lines = code.split("\n");
const issues = [];
lines.forEach((l, i) => {
  if (/[\u05d0-\u05ea]"[\u05d0-\u05ea]/.test(l)) {
    issues.push(`Line ${i+1}: ${l.trim().substring(0, 100)}`);
  }
});
if (issues.length === 0) {
  console.log("No Hebrew quote issues found!");
} else {
  console.log(`Found ${issues.length} issue(s):`);
  issues.forEach(x => console.log(x));
  // Auto-fix them all
  const fixed = code.replace(/([\u05d0-\u05ea])"([\u05d0-\u05ea])/g, "$1\u05f4$2");
  writeFileSync("src/components/OrganData.ts", fixed, "utf8");
  console.log("All fixed and written.");
}
