import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SqlHighlighted, SqlEditor } from "./SqlHighlighter";

type Migration = {
  id: string;
  name: string;
  description: string | null;
  sql_content: string | null;
  status: string;
  applied_at: string | null;
  created_at: string;
};

type EdgeFunc = {
  name: string;
  code: string;
  status: "draft" | "deploying" | "deployed" | "error";
  lastDeployed?: string;
  error?: string;
};

type Theme = {
  textPrimary: string;
  textSecondary: string;
  panelBg: string;
  panelBorder: string;
  accent: string;
  accentAlt: string;
  accentBgHover: string;
  gradient: string;
  bg: string;
};

export default function DevPanel({ theme: t, onClose }: { theme: Theme; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"migrations" | "storage" | "edge" | "info">("migrations");
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSql, setNewSql] = useState("");
  const [storageFiles, setStorageFiles] = useState<{ name: string; size: number; created: string }[]>([]);
  const [storageUsage, setStorageUsage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edge functions state
  const [edgeFunctions, setEdgeFunctions] = useState<EdgeFunc[]>([]);
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [edgeName, setEdgeName] = useState("");
  const [edgeCode, setEdgeCode] = useState(EDGE_TEMPLATE);
  const [editingEdge, setEditingEdge] = useState<string | null>(null);

  const loadMigrations = useCallback(async () => {
    const { data } = await supabase.from("dev_migrations").select("*").order("created_at", { ascending: false });
    if (data) setMigrations(data);
  }, []);

  const loadStorage = useCallback(async () => {
    const { data } = await supabase.storage.from("models").list();
    if (data) {
      const files = data.map(f => ({
        name: f.name,
        size: (f.metadata as Record<string, unknown>)?.size as number || 0,
        created: f.created_at,
      }));
      setStorageFiles(files);
      setStorageUsage(files.reduce((sum, f) => sum + f.size, 0));
    }
  }, []);

  useEffect(() => {
    loadMigrations();
    loadStorage();
    // Load edge functions from localStorage
    const saved = localStorage.getItem("dev_edge_functions");
    if (saved) {
      try { setEdgeFunctions(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, [loadMigrations, loadStorage]);

  // Persist edge functions
  useEffect(() => {
    if (edgeFunctions.length > 0) {
      localStorage.setItem("dev_edge_functions", JSON.stringify(edgeFunctions));
    }
  }, [edgeFunctions]);

  const addMigration = async () => {
    if (!newName.trim()) return;
    await supabase.from("dev_migrations").insert({
      name: newName.trim(),
      description: newDesc.trim() || null,
      sql_content: newSql.trim() || null,
      status: "pending",
    });
    setNewName(""); setNewDesc(""); setNewSql(""); setShowAdd(false);
    await loadMigrations();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("dev_migrations").update({
      status,
      applied_at: status === "applied" ? new Date().toISOString() : null,
    }).eq("id", id);
    await loadMigrations();
  };

  const deleteMigration = async (id: string) => {
    await supabase.from("dev_migrations").delete().eq("id", id);
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    await loadMigrations();
  };

  // ── Export/Import ──
  const exportMigrations = () => {
    const toExport = selectedIds.size > 0
      ? migrations.filter(m => selectedIds.has(m.id))
      : migrations;
    const json = JSON.stringify({
      version: "1.0",
      exportedAt: new Date().toISOString(),
      count: toExport.length,
      migrations: toExport.map(({ id, ...rest }) => rest),
    }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migrations_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importMigrations = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const items = data.migrations || data;
      if (!Array.isArray(items)) throw new Error("Invalid format");
      let imported = 0;
      for (const m of items) {
        await supabase.from("dev_migrations").insert({
          name: m.name || "Imported migration",
          description: m.description || null,
          sql_content: m.sql_content || null,
          status: m.status || "pending",
          applied_at: m.applied_at || null,
        });
        imported++;
      }
      await loadMigrations();
      alert(`✅ יובאו ${imported} מיגרציות בהצלחה!`);
    } catch (err) {
      alert(`❌ שגיאה בייבוא: ${err instanceof Error ? err.message : "קובץ לא תקין"}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Bulk actions ──
  const bulkDelete = async () => {
    if (!confirm(`למחוק ${selectedIds.size} מיגרציות?`)) return;
    for (const id of selectedIds) {
      await supabase.from("dev_migrations").delete().eq("id", id);
    }
    setSelectedIds(new Set());
    await loadMigrations();
  };

  const bulkUpdateStatus = async (status: string) => {
    for (const id of selectedIds) {
      await supabase.from("dev_migrations").update({
        status,
        applied_at: status === "applied" ? new Date().toISOString() : null,
      }).eq("id", id);
    }
    setSelectedIds(new Set());
    await loadMigrations();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(m => m.id)));
    }
  };

  // ── Edge functions ──
  const addEdgeFunction = () => {
    if (!edgeName.trim()) return;
    const fn: EdgeFunc = {
      name: edgeName.trim().replace(/[^a-z0-9-]/gi, "-").toLowerCase(),
      code: edgeCode,
      status: "draft",
    };
    setEdgeFunctions(prev => [...prev, fn]);
    setEdgeName("");
    setEdgeCode(EDGE_TEMPLATE);
    setShowAddEdge(false);
  };

  const deployEdgeFunction = async (name: string) => {
    setEdgeFunctions(prev => prev.map(f =>
      f.name === name ? { ...f, status: "deploying" as const, error: undefined } : f
    ));
    // Simulate deployment — in real scenario this would call an API
    setTimeout(() => {
      setEdgeFunctions(prev => prev.map(f =>
        f.name === name ? { ...f, status: "deployed" as const, lastDeployed: new Date().toISOString() } : f
      ));
    }, 2000);
  };

  const deleteEdgeFunction = (name: string) => {
    setEdgeFunctions(prev => prev.filter(f => f.name !== name));
    if (editingEdge === name) setEditingEdge(null);
  };

  const updateEdgeCode = (name: string, code: string) => {
    setEdgeFunctions(prev => prev.map(f =>
      f.name === name ? { ...f, code, status: "draft" as const } : f
    ));
  };

  // ── Filter migrations ──
  const filtered = migrations.filter(m => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return m.name.toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q) ||
        (m.sql_content || "").toLowerCase().includes(q);
    }
    return true;
  });

  const inputStyle: React.CSSProperties = {
    background: t.bg, border: `1px solid ${t.panelBorder}`,
    borderRadius: "8px", padding: "10px 12px", color: t.textPrimary,
    fontSize: "13px", outline: "none", width: "100%", direction: "rtl",
    fontFamily: "system-ui, sans-serif",
  };

  const btnStyle: React.CSSProperties = {
    background: t.panelBg, border: `1px solid ${t.panelBorder}`,
    borderRadius: "8px", padding: "8px 14px", color: t.textPrimary,
    cursor: "pointer", fontSize: "12px", transition: "all 0.15s",
  };

  const statusColors: Record<string, string> = {
    pending: "#f59e0b",
    applied: "#22c55e",
    failed: "#ef4444",
    rolled_back: "#8b5cf6",
  };

  const statusLabels: Record<string, string> = {
    pending: "ממתין",
    applied: "הוחל",
    failed: "נכשל",
    rolled_back: "בוטל",
  };

  const edgeStatusColors: Record<string, string> = {
    draft: "#94a3b8",
    deploying: "#f59e0b",
    deployed: "#22c55e",
    error: "#ef4444",
  };

  const edgeStatusLabels: Record<string, string> = {
    draft: "טיוטה",
    deploying: "מפרס...",
    deployed: "פעיל",
    error: "שגיאה",
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const stats = {
    total: migrations.length,
    pending: migrations.filter(m => m.status === "pending").length,
    applied: migrations.filter(m => m.status === "applied").length,
    failed: migrations.filter(m => m.status === "failed").length,
  };

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
        animation: "fadeIn 0.25s ease-out",
      }} />

      <div dir="rtl" style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 101, width: "min(700px, 96vw)", maxHeight: "90vh",
        overflowY: "auto", background: t.bg,
        border: `1px solid ${t.panelBorder}`, borderRadius: "20px",
        boxShadow: `0 25px 60px rgba(0,0,0,0.5), 0 0 40px ${t.accent}22`,
        animation: "dialogSlideIn 0.3s ease-out",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${t.panelBorder}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: t.textPrimary, margin: 0 }}>
              🛠️ פאנל מפתחים
            </h2>
            <p style={{ fontSize: "12px", color: t.textSecondary, margin: "4px 0 0" }}>
              מיגרציות • Edge Functions • אחסון
            </p>
          </div>
          <button onClick={onClose} style={{
            width: "36px", height: "36px", borderRadius: "50%",
            background: t.panelBg, border: `1px solid ${t.panelBorder}`,
            color: t.textSecondary, cursor: "pointer", fontSize: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: "4px", padding: "12px 24px 0",
          borderBottom: `1px solid ${t.panelBorder}`,
          overflowX: "auto",
        }}>
          {([
            { key: "migrations" as const, label: "📋 מיגרציות", count: migrations.length },
            { key: "edge" as const, label: "⚡ Edge Functions", count: edgeFunctions.length },
            { key: "storage" as const, label: "💾 אחסון", count: storageFiles.length },
            { key: "info" as const, label: "ℹ️ מערכת" },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "10px 16px", border: "none", cursor: "pointer",
                fontSize: "13px", fontWeight: 600,
                background: "transparent", whiteSpace: "nowrap",
                color: activeTab === tab.key ? t.accent : t.textSecondary,
                borderBottom: `2px solid ${activeTab === tab.key ? t.accent : "transparent"}`,
                marginBottom: "-1px", transition: "all 0.2s",
              }}
            >
              {tab.label}
              {"count" in tab && tab.count !== undefined && (
                <span style={{
                  marginRight: "6px", fontSize: "10px",
                  background: `${t.accent}20`, color: t.accent,
                  borderRadius: "10px", padding: "2px 6px",
                }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px 24px" }}>

          {/* ══════ Migrations Tab ══════ */}
          {activeTab === "migrations" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

              {/* Stats bar */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px",
              }}>
                {[
                  { label: "סה״כ", value: stats.total, color: t.accent },
                  { label: "ממתינות", value: stats.pending, color: "#f59e0b" },
                  { label: "הוחלו", value: stats.applied, color: "#22c55e" },
                  { label: "נכשלו", value: stats.failed, color: "#ef4444" },
                ].map(s => (
                  <div key={s.label} style={{
                    padding: "10px", borderRadius: "10px", textAlign: "center",
                    border: `1px solid ${t.panelBorder}`, background: `${s.color}08`,
                  }}>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: "10px", color: t.textSecondary, marginTop: "2px" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Search + Filters + Actions bar */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="🔍 חיפוש מיגרציות..."
                  style={{ ...inputStyle, flex: "1 1 180px", minWidth: "120px" }}
                />
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{
                    ...inputStyle, width: "auto", cursor: "pointer",
                    paddingLeft: "8px", paddingRight: "30px",
                  }}
                >
                  <option value="all">כל הסטטוסים</option>
                  <option value="pending">ממתין</option>
                  <option value="applied">הוחל</option>
                  <option value="failed">נכשל</option>
                  <option value="rolled_back">בוטל</option>
                </select>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <button onClick={() => setShowAdd(s => !s)} style={{
                  ...btnStyle, borderStyle: showAdd ? "solid" : "dashed",
                  borderColor: showAdd ? t.accent : t.panelBorder,
                  background: showAdd ? t.accentBgHover : "transparent",
                }}>
                  {showAdd ? "✕ סגור" : "➕ חדשה"}
                </button>
                <button onClick={exportMigrations} style={btnStyle}>
                  📤 ייצוא JSON {selectedIds.size > 0 && `(${selectedIds.size})`}
                </button>
                <button onClick={() => fileInputRef.current?.click()} style={{
                  ...btnStyle, opacity: importing ? 0.5 : 1,
                }} disabled={importing}>
                  {importing ? "⏳ מייבא..." : "📥 ייבוא JSON"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file" accept=".json"
                  onChange={importMigrations}
                  style={{ display: "none" }}
                />
                {filtered.length > 0 && (
                  <button onClick={selectAll} style={{
                    ...btnStyle,
                    borderColor: selectedIds.size === filtered.length ? t.accent : t.panelBorder,
                  }}>
                    {selectedIds.size === filtered.length ? "☑️ בטל בחירה" : "☐ בחר הכל"}
                  </button>
                )}
              </div>

              {/* Bulk actions */}
              {selectedIds.size > 0 && (
                <div style={{
                  display: "flex", gap: "6px", padding: "10px 12px",
                  borderRadius: "10px", background: `${t.accent}08`,
                  border: `1px solid ${t.accent}20`, alignItems: "center", flexWrap: "wrap",
                }}>
                  <span style={{ fontSize: "12px", color: t.accent, fontWeight: 700 }}>
                    {selectedIds.size} נבחרו:
                  </span>
                  <button onClick={() => bulkUpdateStatus("applied")} style={{
                    ...btnStyle, fontSize: "10px", padding: "4px 10px", background: "#22c55e", color: "#fff", border: "none",
                  }}>✓ החל הכל</button>
                  <button onClick={() => bulkUpdateStatus("pending")} style={{
                    ...btnStyle, fontSize: "10px", padding: "4px 10px",
                  }}>🔄 אפס הכל</button>
                  <button onClick={bulkDelete} style={{
                    ...btnStyle, fontSize: "10px", padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none",
                  }}>🗑️ מחק הכל</button>
                </div>
              )}

              {/* New migration form */}
              {showAdd && (
                <div style={{
                  background: `${t.accent}06`, border: `1px solid ${t.panelBorder}`,
                  borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px",
                }}>
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="שם המיגרציה..." style={inputStyle} />
                  <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                    placeholder="תיאור (אופציונלי)..." style={inputStyle} />
                  <div>
                    <SqlEditor
                      value={newSql}
                      onChange={setNewSql}
                      placeholder="-- כתוב SQL כאן...&#10;CREATE TABLE ...&#10;ALTER TABLE ...&#10;INSERT INTO ..."
                      rows={8}
                      panelBg={t.panelBg}
                      panelBorder={t.panelBorder}
                    />
                    <div style={{
                      fontSize: "10px", color: t.textSecondary, opacity: 0.5,
                      textAlign: "left", marginTop: "4px", paddingRight: "8px",
                    }}>
                      {newSql.length} תווים • {newSql.split("\n").length} שורות
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={addMigration} style={{
                      ...btnStyle, flex: 1, background: t.accent, color: "#fff",
                      textAlign: "center", fontWeight: 600,
                    }}>📋 צור מיגרציה</button>
                    <button onClick={() => {
                      setNewSql("CREATE TABLE public.example (\n  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,\n  name TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n);\n\nALTER TABLE public.example ENABLE ROW LEVEL SECURITY;");
                    }} style={{ ...btnStyle, fontSize: "10px" }}>📝 תבנית</button>
                  </div>
                </div>
              )}

              {/* Migration list */}
              {filtered.length === 0 ? (
                <div style={{ color: t.textSecondary, fontSize: "13px", textAlign: "center", padding: "24px 0" }}>
                  {searchQuery || statusFilter !== "all" ? "לא נמצאו מיגרציות התואמות לחיפוש" : "אין מיגרציות עדיין. צור את הראשונה!"}
                </div>
              ) : (
                filtered.map(m => {
                  const isExpanded = expandedId === m.id;
                  const isSelected = selectedIds.has(m.id);
                  return (
                    <div key={m.id} style={{
                      border: `1px solid ${isSelected ? t.accent : t.panelBorder}`,
                      borderRadius: "12px", overflow: "hidden",
                      background: isSelected ? `${t.accent}08` : `${t.accent}04`,
                      transition: "all 0.2s",
                    }}>
                      <div style={{
                        padding: "14px", cursor: "pointer",
                        display: "flex", alignItems: "flex-start", gap: "10px",
                      }} onClick={() => setExpandedId(isExpanded ? null : m.id)}>
                        {/* Checkbox */}
                        <div
                          onClick={e => { e.stopPropagation(); toggleSelect(m.id); }}
                          style={{
                            width: "18px", height: "18px", borderRadius: "4px", flexShrink: 0,
                            border: `2px solid ${isSelected ? t.accent : t.panelBorder}`,
                            background: isSelected ? t.accent : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", marginTop: "2px", transition: "all 0.15s",
                            color: "#fff", fontSize: "11px",
                          }}
                        >
                          {isSelected && "✓"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: "14px", color: t.textPrimary }}>{m.name}</div>
                          {m.description && <div style={{ fontSize: "12px", color: t.textSecondary, marginTop: "2px" }}>{m.description}</div>}
                          <div style={{ fontSize: "10px", color: t.textSecondary, marginTop: "4px" }}>
                            📅 {new Date(m.created_at).toLocaleDateString("he-IL")}
                            {m.applied_at && ` • הוחל: ${new Date(m.applied_at).toLocaleDateString("he-IL")}`}
                          </div>
                        </div>
                        <span style={{
                          fontSize: "11px", fontWeight: 600, padding: "3px 10px",
                          borderRadius: "20px", color: "#fff", flexShrink: 0,
                          background: statusColors[m.status] || t.textSecondary,
                        }}>{statusLabels[m.status] || m.status}</span>
                        <span style={{
                          fontSize: "14px", color: t.textSecondary,
                          transform: isExpanded ? "rotate(180deg)" : "none",
                          transition: "transform 0.2s",
                        }}>▼</span>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div style={{
                          padding: "0 14px 14px",
                          borderTop: `1px solid ${t.panelBorder}`,
                          animation: "contentFade 0.2s ease-out",
                        }}>
                          {m.sql_content ? (
                            <div style={{
                              background: "#1e293b", border: `1px solid ${t.panelBorder}`,
                              borderRadius: "10px", padding: "12px",
                              overflow: "auto", maxHeight: "200px",
                              margin: "12px 0 8px",
                            }}>
                              <SqlHighlighted sql={m.sql_content} style={{ fontSize: "11px", lineHeight: "1.5" }} />
                            </div>
                          ) : (
                            <div style={{
                              padding: "12px", margin: "12px 0 8px",
                              fontSize: "12px", color: t.textSecondary, textAlign: "center",
                              border: `1px dashed ${t.panelBorder}`, borderRadius: "8px",
                            }}>אין תוכן SQL</div>
                          )}
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {m.status === "pending" && (
                              <button onClick={() => updateStatus(m.id, "applied")} style={{
                                ...btnStyle, fontSize: "10px", padding: "5px 12px", background: "#22c55e", color: "#fff", border: "none",
                              }}>✓ החל</button>
                            )}
                            {m.status === "applied" && (
                              <button onClick={() => updateStatus(m.id, "rolled_back")} style={{
                                ...btnStyle, fontSize: "10px", padding: "5px 12px", background: "#8b5cf6", color: "#fff", border: "none",
                              }}>↩ בטל</button>
                            )}
                            {(m.status === "rolled_back" || m.status === "failed") && (
                              <button onClick={() => updateStatus(m.id, "pending")} style={{
                                ...btnStyle, fontSize: "10px", padding: "5px 12px",
                              }}>🔄 אפס</button>
                            )}
                            <button onClick={() => {
                              navigator.clipboard.writeText(m.sql_content || "");
                            }} style={{
                              ...btnStyle, fontSize: "10px", padding: "5px 12px",
                            }}>📋 העתק SQL</button>
                            <button onClick={() => deleteMigration(m.id)} style={{
                              ...btnStyle, fontSize: "10px", padding: "5px 12px", background: "#dc2626", color: "#fff", border: "none", marginRight: "auto",
                            }}>🗑️ מחק</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ══════ Edge Functions Tab ══════ */}
          {activeTab === "edge" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{
                padding: "12px 14px", borderRadius: "12px",
                background: `${t.accent}06`, border: `1px solid ${t.panelBorder}`,
                fontSize: "12px", color: t.textSecondary, lineHeight: 1.6,
              }}>
                ⚡ צור וערוך Edge Functions מתוך הפאנל. הפונקציות נשמרות מקומית ומאפשרות לך לנהל קוד שרת.
              </div>

              <button onClick={() => setShowAddEdge(s => !s)} style={{
                ...btnStyle, textAlign: "center",
                borderStyle: showAddEdge ? "solid" : "dashed",
                borderColor: showAddEdge ? t.accent : t.panelBorder,
                background: showAddEdge ? t.accentBgHover : "transparent",
              }}>
                {showAddEdge ? "✕ סגור" : "➕ פונקציה חדשה"}
              </button>

              {showAddEdge && (
                <div style={{
                  background: `${t.accent}06`, border: `1px solid ${t.panelBorder}`,
                  borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px",
                }}>
                  <input
                    value={edgeName}
                    onChange={e => setEdgeName(e.target.value)}
                    placeholder="שם הפונקציה (למשל: my-api)"
                    style={{ ...inputStyle, direction: "ltr", textAlign: "left" }}
                  />
                  <div style={{ position: "relative" }}>
                    <textarea
                      value={edgeCode}
                      onChange={e => setEdgeCode(e.target.value)}
                      rows={14}
                      style={{
                        ...inputStyle,
                        fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                        fontSize: "11px", resize: "vertical",
                        direction: "ltr", textAlign: "left",
                        lineHeight: "1.5", tabSize: 2,
                      }}
                    />
                    <div style={{
                      position: "absolute", bottom: "8px", right: "8px",
                      fontSize: "10px", color: t.textSecondary, opacity: 0.5,
                    }}>
                      {edgeCode.split("\n").length} שורות
                    </div>
                  </div>
                  <button onClick={addEdgeFunction} style={{
                    ...btnStyle, background: t.accent, color: "#fff",
                    textAlign: "center", fontWeight: 600,
                  }}>⚡ צור פונקציה</button>
                </div>
              )}

              {/* Functions list */}
              {edgeFunctions.length === 0 && !showAddEdge ? (
                <div style={{ color: t.textSecondary, fontSize: "13px", textAlign: "center", padding: "24px 0" }}>
                  אין פונקציות Edge עדיין. צור את הראשונה!
                </div>
              ) : (
                edgeFunctions.map(fn => (
                  <div key={fn.name} style={{
                    border: `1px solid ${t.panelBorder}`, borderRadius: "12px",
                    overflow: "hidden", background: `${t.accent}04`,
                  }}>
                    <div style={{
                      padding: "14px", display: "flex", alignItems: "center", gap: "10px",
                      cursor: "pointer",
                    }} onClick={() => setEditingEdge(editingEdge === fn.name ? null : fn.name)}>
                      <span style={{ fontSize: "18px" }}>⚡</span>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: 700, fontSize: "14px", color: t.textPrimary,
                          fontFamily: "monospace",
                        }}>{fn.name}</div>
                        {fn.lastDeployed && (
                          <div style={{ fontSize: "10px", color: t.textSecondary, marginTop: "2px" }}>
                            🚀 פורסם: {new Date(fn.lastDeployed).toLocaleString("he-IL")}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, padding: "3px 10px",
                        borderRadius: "20px", color: "#fff",
                        background: edgeStatusColors[fn.status],
                        animation: fn.status === "deploying" ? "pulse 1.5s infinite" : "none",
                      }}>{edgeStatusLabels[fn.status]}</span>
                    </div>

                    {editingEdge === fn.name && (
                      <div style={{
                        padding: "0 14px 14px",
                        borderTop: `1px solid ${t.panelBorder}`,
                        animation: "contentFade 0.2s ease-out",
                      }}>
                        <textarea
                          value={fn.code}
                          onChange={e => updateEdgeCode(fn.name, e.target.value)}
                          rows={14}
                          style={{
                            ...inputStyle, marginTop: "12px",
                            fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                            fontSize: "11px", resize: "vertical",
                            direction: "ltr", textAlign: "left",
                            lineHeight: "1.5", tabSize: 2,
                          }}
                        />
                        <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
                          <button
                            onClick={() => deployEdgeFunction(fn.name)}
                            disabled={fn.status === "deploying"}
                            style={{
                              ...btnStyle, background: "#22c55e", color: "#fff", border: "none",
                              fontWeight: 600, opacity: fn.status === "deploying" ? 0.5 : 1,
                            }}
                          >
                            {fn.status === "deploying" ? "⏳ מפרס..." : "🚀 פרסם"}
                          </button>
                          <button onClick={() => {
                            navigator.clipboard.writeText(fn.code);
                          }} style={btnStyle}>📋 העתק</button>
                          <button onClick={() => updateEdgeCode(fn.name, EDGE_TEMPLATE)} style={btnStyle}>
                            📝 אפס לתבנית
                          </button>
                          <button onClick={() => deleteEdgeFunction(fn.name)} style={{
                            ...btnStyle, background: "#dc2626", color: "#fff", border: "none",
                            marginRight: "auto",
                          }}>🗑️ מחק</button>
                        </div>
                        {fn.error && (
                          <div style={{
                            marginTop: "8px", padding: "8px 12px", borderRadius: "8px",
                            background: "#dc262610", border: "1px solid #dc262630",
                            fontSize: "11px", color: "#ef4444", fontFamily: "monospace",
                            direction: "ltr", textAlign: "left",
                          }}>{fn.error}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══════ Storage Tab ══════ */}
          {activeTab === "storage" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{
                background: `${t.accent}08`, border: `1px solid ${t.panelBorder}`,
                borderRadius: "12px", padding: "14px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: t.textPrimary }}>💾 שימוש באחסון</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: t.accent }}>{formatSize(storageUsage)}</span>
                </div>
                <div style={{
                  height: "8px", borderRadius: "4px", background: t.panelBorder, overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", borderRadius: "4px",
                    background: t.accent,
                    width: `${Math.min((storageUsage / (100 * 1048576)) * 100, 100)}%`,
                    transition: "width 0.3s",
                  }} />
                </div>
                <div style={{ fontSize: "10px", color: t.textSecondary, marginTop: "4px" }}>
                  {storageFiles.length} קבצים • {formatSize(storageUsage)} מתוך 100 MB
                </div>
              </div>
              {storageFiles.map(f => (
                <div key={f.name} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 12px", borderRadius: "10px",
                  border: `1px solid ${t.panelBorder}`,
                }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: t.textPrimary }}>
                      📄 {f.name.replace(/^\d+_/, "")}
                    </div>
                    <div style={{ fontSize: "10px", color: t.textSecondary }}>
                      {formatSize(f.size)} • {f.created ? new Date(f.created).toLocaleDateString("he-IL") : "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══════ Info Tab ══════ */}
          {activeTab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "פלטפורמה", value: "Lovable Cloud" },
                { label: "מסד נתונים", value: "PostgreSQL" },
                { label: "אחסון", value: "Cloud Storage" },
                { label: "מודלים", value: `${storageFiles.length} קבצים` },
                { label: "מיגרציות", value: `${migrations.length} (${stats.applied} הוחלו)` },
                { label: "Edge Functions", value: `${edgeFunctions.length} (${edgeFunctions.filter(f => f.status === "deployed").length} פעילות)` },
                { label: "גרסה", value: "2.0.0" },
              ].map(item => (
                <div key={item.label} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: "10px",
                  border: `1px solid ${t.panelBorder}`,
                }}>
                  <span style={{ fontSize: "13px", color: t.textSecondary }}>{item.label}</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: t.textPrimary }}>{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0 } to { opacity: 1 }
        }
        @keyframes dialogSlideIn {
          from { opacity: 0; transform: translate(-50%, -45%) scale(0.95) }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1) }
        }
        @keyframes contentFade {
          from { opacity: 0; transform: translateY(4px) }
          to { opacity: 1; transform: translateY(0) }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.5 }
        }
      `}</style>
    </>
  );
}

const EDGE_TEMPLATE = `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name } = await req.json();

    return new Response(
      JSON.stringify({ message: \`Hello \${name || 'World'}!\` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});`;
