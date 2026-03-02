import { useMemo } from "react";

const SQL_KEYWORDS = [
  "SELECT","FROM","WHERE","INSERT","INTO","VALUES","UPDATE","SET","DELETE",
  "CREATE","ALTER","DROP","TABLE","INDEX","VIEW","FUNCTION","TRIGGER",
  "PRIMARY","KEY","FOREIGN","REFERENCES","NOT","NULL","DEFAULT","UNIQUE",
  "CHECK","CONSTRAINT","CASCADE","ON","AND","OR","IN","IS","AS","JOIN",
  "LEFT","RIGHT","INNER","OUTER","CROSS","FULL","UNION","ALL","DISTINCT",
  "ORDER","BY","GROUP","HAVING","LIMIT","OFFSET","ASC","DESC","EXISTS",
  "BETWEEN","LIKE","ILIKE","CASE","WHEN","THEN","ELSE","END","WITH",
  "RECURSIVE","RETURNS","LANGUAGE","BEGIN","RETURN","DECLARE","IF","ELSIF",
  "LOOP","FOR","EACH","ROW","EXECUTE","PROCEDURE","REPLACE","SECURITY",
  "DEFINER","INVOKER","ENABLE","DISABLE","POLICY","USING","GRANT","REVOKE",
  "ROLE","SCHEMA","PUBLIC","BEFORE","AFTER","INSTEAD","OF","NEW","OLD",
  "PUBLICATION","ADD","COLUMN","TYPE","ENUM","BOOLEAN","TEXT","INTEGER",
  "INT","BIGINT","SMALLINT","SERIAL","UUID","TIMESTAMP","TIMESTAMPTZ",
  "DATE","TIME","NUMERIC","DECIMAL","FLOAT","DOUBLE","PRECISION","VARCHAR",
  "CHAR","JSONB","JSON","BYTEA","ARRAY","TRUE","FALSE","NOW","COALESCE",
  "COUNT","SUM","AVG","MIN","MAX","ROW_LEVEL","SEARCH_PATH",
];

const kwRegex = new RegExp(
  `\\b(${SQL_KEYWORDS.join("|")})\\b`, "gi"
);

type Token =
  | { type: "keyword"; text: string }
  | { type: "string"; text: string }
  | { type: "comment"; text: string }
  | { type: "number"; text: string }
  | { type: "function"; text: string }
  | { type: "operator"; text: string }
  | { type: "plain"; text: string };

function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  // Combined regex for all token types
  const re = /--[^\n]*|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\b\d+(?:\.\d+)?\b|\b[a-zA-Z_]\w*(?=\s*\()|[<>=!]+|[^-'"\d\s<>=!a-zA-Z_]+|\b[a-zA-Z_]\w*\b|\s+|./g;
  
  let match;
  while ((match = re.exec(sql)) !== null) {
    const text = match[0];
    if (text.startsWith("--")) {
      tokens.push({ type: "comment", text });
    } else if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
      tokens.push({ type: "string", text });
    } else if (/^\d+(?:\.\d+)?$/.test(text)) {
      tokens.push({ type: "number", text });
    } else if (/^[a-zA-Z_]\w*$/.test(text) && kwRegex.test(text)) {
      kwRegex.lastIndex = 0;
      tokens.push({ type: "keyword", text });
    } else if (/^[a-zA-Z_]\w*$/.test(text) && sql[match.index + text.length] === '(' ) {
      // Lookahead for function calls was done in regex
      tokens.push({ type: "function", text });
    } else if (/^[<>=!]+$/.test(text)) {
      tokens.push({ type: "operator", text });
    } else {
      tokens.push({ type: "plain", text });
    }
  }
  return tokens;
}

// Re-tokenize with a simpler approach
function tokenizeSimple(sql: string): Token[] {
  const tokens: Token[] = [];
  const re = /(--[^\n]*)|((?:'(?:[^'\\]|\\.)*')|(?:"(?:[^"\\]|\\.)*"))|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*\b)|([\s]+)|(.)/g;
  let m;
  while ((m = re.exec(sql)) !== null) {
    if (m[1]) {
      tokens.push({ type: "comment", text: m[1] });
    } else if (m[2]) {
      tokens.push({ type: "string", text: m[2] });
    } else if (m[3]) {
      tokens.push({ type: "number", text: m[3] });
    } else if (m[4]) {
      const word = m[4];
      if (kwRegex.test(word)) {
        kwRegex.lastIndex = 0;
        tokens.push({ type: "keyword", text: word });
      } else if (sql[m.index + word.length] === "(") {
        tokens.push({ type: "function", text: word });
      } else {
        tokens.push({ type: "plain", text: word });
      }
    } else {
      tokens.push({ type: "plain", text: m[5] || m[6] || "" });
    }
  }
  return tokens;
}

const COLORS: Record<Token["type"], string> = {
  keyword: "#c792ea",
  string: "#c3e88d",
  comment: "#546e7a",
  number: "#f78c6c",
  function: "#82aaff",
  operator: "#89ddff",
  plain: "#d6deeb",
};

export function SqlHighlighted({
  sql,
  style,
}: {
  sql: string;
  style?: React.CSSProperties;
}) {
  const tokens = useMemo(() => tokenizeSimple(sql), [sql]);

  return (
    <pre
      style={{
        margin: 0,
        fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
        fontSize: "12px",
        lineHeight: "1.6",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        direction: "ltr",
        textAlign: "left",
        ...style,
      }}
    >
      {tokens.map((tok, i) => (
        <span key={i} style={{ color: COLORS[tok.type], fontStyle: tok.type === "comment" ? "italic" : undefined }}>
          {tok.text}
        </span>
      ))}
    </pre>
  );
}

/**
 * SQL editor with syntax highlighting overlay.
 * Uses a transparent textarea over a highlighted pre element.
 */
export function SqlEditor({
  value,
  onChange,
  placeholder,
  rows = 8,
  panelBg,
  panelBorder,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  panelBg: string;
  panelBorder: string;
}) {
  return (
    <div style={{ position: "relative", borderRadius: "10px", overflow: "hidden", border: `1px solid ${panelBorder}` }}>
      {/* Highlighted layer behind */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          padding: "12px",
          overflow: "auto",
          background: "#1e293b",
          pointerEvents: "none",
        }}
      >
        <SqlHighlighted
          sql={value || ""}
          style={{ minHeight: `${rows * 1.6}em` }}
        />
      </div>
      {/* Transparent textarea on top */}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        spellCheck={false}
        style={{
          position: "relative",
          width: "100%",
          padding: "12px",
          fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
          fontSize: "12px",
          lineHeight: "1.6",
          direction: "ltr",
          textAlign: "left",
          background: "transparent",
          color: "transparent",
          caretColor: "#e2e8f0",
          border: "none",
          outline: "none",
          resize: "vertical",
          tabSize: 2,
          minHeight: `${rows * 1.6 + 1.5}em`,
        }}
        onKeyDown={e => {
          // Tab support
          if (e.key === "Tab") {
            e.preventDefault();
            const ta = e.currentTarget;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const newVal = value.substring(0, start) + "  " + value.substring(end);
            onChange(newVal);
            requestAnimationFrame(() => {
              ta.selectionStart = ta.selectionEnd = start + 2;
            });
          }
        }}
      />
    </div>
  );
}
