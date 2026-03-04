# מדריך מיגרציות מותאם — human-model-viewer

המדריך מותאם לפרויקט הזה בלבד, ומיישם את אותו עיקרון שעבד בפרויקטי Lovable: **לא צריך לחשוף Service Role Key בפרונט**.

## פרטי הפרויקט (מאומתים)
- Project ref: `ouuixsnealrwymlvtjxr`
- Supabase URL: `https://ouuixsnealrwymlvtjxr.supabase.co`
- Frontend key: `VITE_SUPABASE_PUBLISHABLE_KEY` (anon/public)

## עיקרון חשוב
- `anon/publishable key` מתאים ל-Data API ולבדיקות גישה לפי RLS.
- להרצת מיגרציות ענן צריך אחת משתי דרכים:
  1. `Supabase CLI login` (בדפדפן), ואז `link + db push`.
  2. SQL Editor בדאשבורד Supabase (הרצה ידנית של קבצי migration).

---

## מסלול A (מומלץ) — Supabase CLI בלי secret ידני

### 1) בדיקת CLI
```powershell
npx --yes supabase --version
```

### 2) התחברות (פותח דפדפן)
```powershell
npx --yes supabase login
```

### 3) קישור לפרויקט הנכון
```powershell
npx --yes supabase link --project-ref ouuixsnealrwymlvtjxr
```

### 4) בדיקת מצב מיגרציות
```powershell
npx --yes supabase migration list --linked
```

### 5) דחיפת מיגרציות
```powershell
npx --yes supabase db push --linked
```

### 6) אימות מהיר
```powershell
npx --yes supabase migration list --linked
```

---

## מסלול B — SQL Editor (אם אין/לא רוצים CLI login)

1. פתח SQL Editor:
   - `https://supabase.com/dashboard/project/ouuixsnealrwymlvtjxr/sql/new`
2. הרץ את קבצי המיגרציה לפי הסדר הכרונולוגי מתוך `supabase/migrations`.
3. אשר שאין שגיאות, ואז בדוק שהתבניות/טבלאות נוצרו.

---

## בדיקת חיבור Data API (לא מיגרציה, רק אימות key/url)
```powershell
$envText = Get-Content .env -Raw
$url = [regex]::Match($envText,'VITE_SUPABASE_URL="([^"]+)"').Groups[1].Value
$key = [regex]::Match($envText,'VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"').Groups[1].Value
$headers = @{ apikey=$key; Authorization="Bearer $key" }
Invoke-RestMethod -Method Get -Uri "$url/rest/v1/model_categories?select=id,name&limit=1" -Headers $headers
```

---

## הערות אבטחה והתאמה ל-Lovable
- לא לשים Service Role Key בקוד לקוח.
- `anon` key ציבורי וזה תקין.
- אם ה-CLI מבקש token, פשוט `supabase login` בדפדפן במקום להדביק secret ידנית.

---

## מה כבר ידוע על הפרויקט הזה
- חיבור Data API תקין עם ה-URL/anon key הנוכחיים.
- כרגע המיגרציות לא רצות ישירות כי לא בוצע `supabase login` בסביבת ה-CLI המקומית.
