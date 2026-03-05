import { readFileSync, writeFileSync } from "fs";

const filePath = "src/components/OrganData.ts";
let code = readFileSync(filePath, "utf8");

// Hebrew abbreviations like מ"ר (sq.m.), מ"ל (ml), ק"ג (kg), ס"מ (cm) etc.
// use a straight double-quote character " inside a TS string literal → syntax error.
// Replace HebrewLetter + " + HebrewLetter  →  HebrewLetter + ״ (Gershayim U+05F4) + HebrewLetter
const GERSHAYIM = "\u05F4";
const before = (code.match(/[\u05d0-\u05ea]"/g) || []).length;
code = code.replace(/([\u05d0-\u05ea])"([\u05d0-\u05ea])/g, `$1${GERSHAYIM}$2`);
const after = (code.match(/[\u05d0-\u05ea]"/g) || []).length;

writeFileSync(filePath, code, "utf8");
console.log(`Fixed ${before - after} occurrence(s). Remaining: ${after}`);
