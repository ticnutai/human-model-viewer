

# תוכנית: טאב "זיהוי וניתוח" — מערכת ניתוח חכמה עם AI

## סקירה

הוספת טאב רביעי "🧠 זיהוי וניתוח" ב-ModelManager, לצד מודלים/מיפוי/רשומות. הטאב יכיל מערכת ניתוח מתקדמת עם:
- ניתוח מקבילי ברקע (Web Workers) שלא חוסם UI
- זיהוי AI אופציונלי דרך Lovable AI Gateway
- סטטוס בזמן אמת, progress bars, ותוצאות מפורטות

## ארכיטקטורה

```text
┌─────────────────────────────────────────┐
│  ModelManager Tabs                       │
│  📦 מודלים │ 🗺️ מיפוי │ 📋 רשומות │ 🧠 ניתוח │
└─────────────────────────────────────────┘
                                    │
                          AnalysisPanel.tsx
                         ┌────────────────┐
                         │ Dashboard       │
                         │ • סטטיסטיקות   │
                         │ • כפתור ניתוח  │
                         │ • תוצאות חיות  │
                         └───────┬────────┘
                    ┌────────────┼────────────┐
               Fast Parser   Workers(×4)   AI Edge Fn
               (Tier 1)      (Tier 2)      (Tier 3)
```

## רכיבים ליצירה

### 1. `src/components/ModelManager/AnalysisPanel.tsx` — רכיב ראשי

פאנל ניתוח עצמאי הכולל:
- **Dashboard**: כמה מודלים נותחו / ממתינים / נכשלו
- **כפתורי פעולה**: "נתח הכל", "נתח חדשים בלבד", "ניתוח AI מעמיק"
- **מערכת תור מקבילית**: מריץ עד 4 ניתוחים במקביל באמצעות `Promise` pool
- **רשימת תוצאות חיות**: כל מודל מציג סטטוס (ממתין/רץ/הצליח/נכשל) עם mesh count ושם עברי
- **פילטרים**: הצג רק לא-מנותחים, רק שגיאות, חיפוש

### 2. `src/components/ModelManager/ParallelAnalysisEngine.ts` — מנוע מקבילי

- Pool של עד 4 ניתוחים בו-זמנית (`concurrency = 4`)
- כל ניתוח עוטף את `analyzeGlbSmart` עם timeout
- עובד ברקע — משתמש ב-`requestIdleCallback` ו-`AbortController`
- לא נחסם כשעוברים טאב (הניתוח ב-Worker threads)
- מחזיר events דרך callback: `onProgress`, `onModelDone`, `onComplete`

### 3. `supabase/functions/ai-analyze-mesh/index.ts` — Edge Function לזיהוי AI

- מקבל רשימת mesh names ומשתמש ב-Lovable AI (Gemini) לזיהוי אנטומי
- מחזיר: שם עברי, מערכת גוף, אייקון, סיכום קצר לכל mesh
- Tool calling לקבלת structured output
- טיפול בשגיאות 429/402

### 4. עדכון `ModelManager/index.tsx`

- הוספת טאב רביעי `"analysis"` ב-tab switcher
- רינדור `<AnalysisPanel>` כשהטאב פעיל
- העברת `models` ו-`load` כ-props

## זרימת ניתוח מקבילי

1. המשתמש לוחץ "נתח הכל"
2. `ParallelAnalysisEngine` יוצר תור של כל המודלים הלא-מנותחים
3. מריץ 4 במקביל — כל אחד עובר דרך `analyzeGlbSmart` (3-tier)
4. כל תוצאה מעדכנת DB ומרעננת UI בזמן אמת
5. אופציה: "העשרת AI" — שולח את ה-mesh names ל-Edge Function שמזהה אנטומית

## ניתוח AI — זרימה

1. לאחר ניתוח GLB רגיל, המשתמש יכול ללחוץ "🤖 זיהוי AI"
2. שולח את רשימת ה-meshes ל-`ai-analyze-mesh` Edge Function
3. ה-Edge Function משתמש ב-Lovable AI עם tool calling לזיהוי מבני
4. התוצאה נשמרת ב-`mesh_parts` ו-`model_mesh_mappings`

## פרטים טכניים

- **מקביליות**: `Promise.allSettled` עם pool חכם (semaphore pattern) — מונע חסימת main thread
- **רקע**: Web Workers (כבר קיים `MeshAnalysisWorker.ts`) + ה-pool רץ ב-async ולא חוסם
- **עמידות בהחלפת טאבים**: ה-Workers ממשיכים לרוץ גם כשעוברים טאב כי הם threads נפרדים. ה-state נשמר ב-ref
- **UI**: Progress bar כללי + כרטיס לכל מודל עם סטטוס אישי
- **config.toml**: הוספת `[functions.ai-analyze-mesh]` עם `verify_jwt = false`

