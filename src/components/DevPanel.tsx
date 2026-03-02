import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type Migration = {
  id: string;
  name: string;
  description: string | null;
  sql_content: string | null;
  status: string;
  applied_at: string | null;
  created_at: string;
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
  const [activeTab, setActiveTab] = useState<"migrations" | "storage" | "info">("migrations");
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSql, setNewSql] = useState("");
  const [storageFiles, setStorageFiles] = useState<{ name: string; size: number; created: string }[]>([]);
  const [storageUsage, setStorageUsage] = useState(0);

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
  }, [loadMigrations, loadStorage]);

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
    await loadMigrations();
  };

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

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
        animation: "fadeIn 0.25s ease-out",
      }} />

      {/* Panel */}
      <div dir="rtl" style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 101, width: "min(600px, 94vw)", maxHeight: "85vh",
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
              ניהול מיגרציות, אחסון ומערכת
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
        }}>
          {([
            { key: "migrations", label: "📋 מיגרציות", count: migrations.length },
            { key: "storage", label: "💾 אחסון", count: storageFiles.length },
            { key: "info", label: "ℹ️ מידע מערכת" },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "10px 16px", border: "none", cursor: "pointer",
                fontSize: "13px", fontWeight: 600,
                background: "transparent",
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
          {/* ── Migrations Tab ── */}
          {activeTab === "migrations" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button
                onClick={() => setShowAdd(s => !s)}
                style={{
                  ...btnStyle, textAlign: "center", display: "flex",
                  justifyContent: "center", gap: "6px",
                  background: showAdd ? t.accentBgHover : "transparent",
                  borderColor: showAdd ? t.accent : t.panelBorder,
                  borderStyle: showAdd ? "solid" : "dashed",
                }}
              >
                {showAdd ? "✕ סגור" : "➕ מיגרציה חדשה"}
              </button>

              {showAdd && (
                <div style={{
                  background: `${t.accent}06`, border: `1px solid ${t.panelBorder}`,
                  borderRadius: "12px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px",
                }}>
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="שם המיגרציה..." style={inputStyle} />
                  <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                    placeholder="תיאור (אופציונלי)..." style={inputStyle} />
                  <textarea value={newSql} onChange={e => setNewSql(e.target.value)}
                    placeholder="תוכן SQL (אופציונלי)..."
                    rows={4}
                    style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px", resize: "vertical" }} />
                  <button onClick={addMigration} style={{
                    ...btnStyle, background: t.accent, color: "#fff",
                    textAlign: "center", fontWeight: 600,
                  }}>📋 צור מיגרציה</button>
                </div>
              )}

              {/* Migration list */}
              {migrations.length === 0 ? (
                <div style={{ color: t.textSecondary, fontSize: "13px", textAlign: "center", padding: "24px 0" }}>
                  אין מיגרציות עדיין. צור את הראשונה!
                </div>
              ) : (
                migrations.map(m => (
                  <div key={m.id} style={{
                    border: `1px solid ${t.panelBorder}`, borderRadius: "12px",
                    padding: "14px", background: `${t.accent}04`,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: t.textPrimary }}>{m.name}</div>
                        {m.description && <div style={{ fontSize: "12px", color: t.textSecondary, marginTop: "2px" }}>{m.description}</div>}
                      </div>
                      <span style={{
                        fontSize: "11px", fontWeight: 600, padding: "3px 10px",
                        borderRadius: "20px", color: "#fff",
                        background: statusColors[m.status] || t.textSecondary,
                      }}>{statusLabels[m.status] || m.status}</span>
                    </div>

                    {m.sql_content && (
                      <pre style={{
                        background: t.bg, border: `1px solid ${t.panelBorder}`,
                        borderRadius: "8px", padding: "10px", fontSize: "11px",
                        color: t.textSecondary, overflow: "auto", maxHeight: "120px",
                        fontFamily: "monospace", direction: "ltr", textAlign: "left",
                        margin: "8px 0",
                      }}>{m.sql_content}</pre>
                    )}

                    <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "10px", color: t.textSecondary, marginLeft: "auto", display: "flex", alignItems: "center" }}>
                        📅 {new Date(m.created_at).toLocaleDateString("he-IL")}
                        {m.applied_at && ` • הוחל: ${new Date(m.applied_at).toLocaleDateString("he-IL")}`}
                      </span>
                      {m.status === "pending" && (
                        <button onClick={() => updateStatus(m.id, "applied")} style={{
                          ...btnStyle, fontSize: "10px", padding: "4px 10px", background: "#22c55e", color: "#fff", border: "none",
                        }}>✓ החל</button>
                      )}
                      {m.status === "applied" && (
                        <button onClick={() => updateStatus(m.id, "rolled_back")} style={{
                          ...btnStyle, fontSize: "10px", padding: "4px 10px", background: "#8b5cf6", color: "#fff", border: "none",
                        }}>↩ בטל</button>
                      )}
                      {(m.status === "rolled_back" || m.status === "failed") && (
                        <button onClick={() => updateStatus(m.id, "pending")} style={{
                          ...btnStyle, fontSize: "10px", padding: "4px 10px",
                        }}>🔄 אפס</button>
                      )}
                      <button onClick={() => deleteMigration(m.id)} style={{
                        ...btnStyle, fontSize: "10px", padding: "4px 10px", background: "#dc2626", color: "#fff", border: "none",
                      }}>🗑️ מחק</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Storage Tab ── */}
          {activeTab === "storage" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Usage bar */}
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
                    background: t.gradient,
                    width: `${Math.min((storageUsage / (100 * 1048576)) * 100, 100)}%`,
                    transition: "width 0.3s",
                  }} />
                </div>
                <div style={{ fontSize: "10px", color: t.textSecondary, marginTop: "4px" }}>
                  {storageFiles.length} קבצים • {formatSize(storageUsage)} מתוך 100 MB
                </div>
              </div>

              {/* File list */}
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

          {/* ── Info Tab ── */}
          {activeTab === "info" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "פלטפורמה", value: "Lovable Cloud" },
                { label: "מסד נתונים", value: "PostgreSQL" },
                { label: "אחסון", value: "Supabase Storage" },
                { label: "מודלים", value: `${storageFiles.length} קבצים` },
                { label: "מיגרציות", value: `${migrations.length} (${migrations.filter(m => m.status === "applied").length} הוחלו)` },
                { label: "גרסה", value: "1.0.0" },
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
      `}</style>
    </>
  );
}
