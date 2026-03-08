
# תוכנית שדרוג מקצועי למערכת ניהול המודלים והממשק

## סקירת מצב נוכחי

**ModelManager.tsx** — 1594 שורות, כל הסגנונות inline styles, ללא שימוש בטוקנים של Tailwind. הקומפוננטה מכילה: קטגוריות, פילטר מדיה, חיפוש Sketchfab, העלאת קבצים, רשימת מודלים, עריכה, ניתוח Mesh — הכל בקובץ אחד ענק.

**ModelViewer.tsx** — 1251 שורות, עבר שדרוג עיצוב אחרון אבל עדיין מכיל אלפי שורות של UI בקובץ אחד.

**AdvancedAnatomyViewer.tsx** — 1418 שורות, כנ"ל.

## מה נבנה

### 1. פירוק ModelManager לקומפוננטות נפרדות

| קומפוננטה חדשה | תפקיד |
|---|---|
| `ModelManager/index.tsx` | מעטפת ראשית, state, data loading |
| `ModelManager/CategoryTabs.tsx` | טאבי קטגוריות + הוספת קטגוריה |
| `ModelManager/MediaFilter.tsx` | פילטר סוג מדיה + מיון + MASH |
| `ModelManager/UploadZone.tsx` | אזור העלאה + רשימת העלאות פעילות |
| `ModelManager/ModelCard.tsx` | כרטיס מודל בודד + פעולות + עריכה |
| `ModelManager/ModelEditForm.tsx` | טופס עריכת מודל מורחב |
| `ModelManager/SketchfabSearch.tsx` | חיפוש Sketchfab + תצוגה מקדימה + ייבוא |

### 2. מעבר מ-inline styles ל-Tailwind + CSS tokens

כל הקומפוננטות ישתמשו ב:
- קלאסים מ-`index.css` (`.glass-panel`, `.organ-card`, `.settings-item`, `.sidebar-tab`)
- Tailwind classes (`text-foreground`, `bg-card`, `border-border`, `text-primary`)
- הסרת ה-`theme: Theme` prop — במקום זה נשתמש ב-CSS variables

### 3. מבנה תיקיות מקצועי

```text
src/components/
  ModelManager/
    index.tsx           ← נקודת כניסה ראשית
    CategoryTabs.tsx    ← טאבים + ניהול קטגוריות
    MediaFilter.tsx     ← פילטרים + מיון
    UploadZone.tsx      ← drag & drop + העלאה מרובה
    ModelCard.tsx        ← כרטיס מודל
    ModelEditForm.tsx   ← טופס עריכה
    SketchfabSearch.tsx ← חיפוש וייבוא מ-Sketchfab
    types.ts            ← כל הטייפים המשותפים
    utils.ts            ← פונקציות עזר (translateMeshName, buildRelevance, etc.)
```

### 4. שדרוגי עיצוב

- **כרטיסי מודלים**: תמונה ממוזערת עגולה, שם ברור, badges צבעוניים, פעולות מרחפות
- **אזור העלאה**: Drag & Drop עם אנימציה, progress bars מעוצבים
- **קטגוריות**: chips/pills מעוצבים עם ספירה, צבעי הדגשה
- **Sketchfab**: grid של תמונות ממוזערות במקום רשימה ארוכה
- **כל האלמנטים**: שימוש ב-shadcn components (Badge, Card, Progress, Tabs, ScrollArea) במקום HTML גולמי

### 5. שיפורים פונקציונליים

- **Drag & Drop** — תמיכה בגרירת קבצים לאזור ההעלאה
- **חיפוש מהיר** — שדה חיפוש בראש רשימת המודלים לסינון מיידי
- **Empty states** — מצבים ריקים מעוצבים עם הנחיות ברורות
- **Keyboard navigation** — Enter/Escape בטפסים

### צעדי יישום

1. צור `types.ts` ו-`utils.ts` עם הלוגיקה המשותפת
2. בנה כל קומפוננטה בנפרד עם Tailwind
3. הרכב ב-`index.tsx` הראשי
4. עדכן ייבוא ב-`ModelViewer.tsx`
5. הסר את ה-`theme` prop — הכל עובד דרך CSS variables
