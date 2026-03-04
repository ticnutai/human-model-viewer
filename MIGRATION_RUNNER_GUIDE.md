# מדריך הרצת מיגרציות — human-model-viewer

המדריך הזה מותאם לפרויקט הזה בלבד.

## פרטי פרויקט (מה-ENV)
- `project_ref`: `ouuixsnealrwymlvtjxr`
- `VITE_SUPABASE_URL`: `https://ouuixsnealrwymlvtjxr.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: anon key (ל-Data API בלבד)

## חשוב להבין
- עם `URL + anon key` אפשר לגשת לנתונים לפי הרשאות RLS.
- **לא** ניתן להריץ מיגרציות ענן עם anon key.
- להרצת מיגרציות ענן צריך `SUPABASE_ACCESS_TOKEN` (CLI token) או סיסמת DB לחיבור Postgres.

---

## 1) בדיקת חיבור Data API (עובד עם anon)
```powershell
$envText = Get-Content .env -Raw
$url = [regex]::Match($envText,'VITE_SUPABASE_URL="([^"]+)"').Groups[1].Value
$key = [regex]::Match($envText,'VITE_SUPABASE_PUBLISHABLE_KEY="([^"]+)"').Groups[1].Value
$headers = @{ apikey=$key; Authorization="Bearer $key" }
Invoke-RestMethod -Method Get -Uri "$url/rest/v1/model_categories?select=id,name&limit=1" -Headers $headers
```

---

## 2) התחברות CLI (נדרש למיגרציות ענן)
אפשרות מומלצת:
```powershell
npx supabase login
```

או עם טוקן:
```powershell
$env:SUPABASE_ACCESS_TOKEN="<your_supabase_access_token>"
```

---

## 3) קישור לפרויקט
```powershell
npx supabase link --project-ref ouuixsnealrwymlvtjxr
```

## 4) בדיקת מיגרציות
```powershell
npx supabase migration list --linked
```

## 5) הרצת מיגרציות לענן
```powershell
npx supabase db push --linked
```

---

## מיגרציה חדשה בפרויקט
- `supabase/migrations/20260302230730_add_model_mesh_mappings.sql`

טבלה שנוספה: `model_mesh_mappings`

---

## מצב "גם וגם"
- ללא מיגרציה: המיפויים נשמרים מקומית (`localStorage`).
- אחרי מיגרציה בענן: המיפויים נשמרים גם בענן Supabase.
