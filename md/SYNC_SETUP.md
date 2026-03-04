# מדריך סינכרון דו-צדדי 🔄

מערכת סינכרון מלאה בין המחשב המקומי, GitHub ו-Supabase

## התקנה מהירה ⚡

```bash
# 1. שכפול הפרויקט (כבר בוצע)
git clone https://github.com/ticnutai/remix-of-crm-p.git
cd remix-of-crm-p

# 2. התקנת תלותים  
npm install

# 3. הגדרת .env (ערוך את הקובץ עם הפרטים שלך)
# קובץ .env כבר נוצר - עדכן את VITE_SUPABASE_PUBLISHABLE_KEY

# 4. התקנת Git Hooks (אוטומטית)
.\install-hooks.ps1
```

## שימוש בסינכרון 🚀

### פקודות NPM (מומלץ)

```bash
# סינכרון מלא (pull + push)
npm run sync

# רק דחיפה לענן
npm run sync:push

# רק משיכה מהענן
npm run sync:pull

# בדיקת סטטוס
npm run sync:status
```

### הרצה ישירה של סקריפטים

```powershell
# סינכרון מלא
.\sync-full.ps1

# דחיפה עם הודעה מותאמת
.\sync-push.ps1 "הוספתי פיצ'ר חדש"

# משיכה
.\sync-pull.ps1

# בדיקת סטטוס
.\sync-status.ps1
```

## זרימת עבודה מומלצת 📋

### תחילת עבודה (בבוקר / פתיחת פרויקט)
```bash
npm run sync:pull
```
משיכת עדכונים אחרונים מהענן

### במהלך העבודה
```bash
# פשוט עבוד רגיל עם git:
git add .
git commit -m "הודעה"
git push  # <- Git hooks יבדקו אוטומטית
```

### סיום עבודה (ערב / סגירת פרויקט)
```bash
npm run sync:push
```
דחיפת כל השינויים

### סינכרון מלא (אם עברת זמן בלי לעבוד)
```bash
npm run sync  # pull + push מלא
```

## מה קורה אוטומטית? 🤖

### Git Hooks פעילים:

✅ **Pre-Commit** - לפני כל commit:
- בודק lint errors
- מזהיר אם יש בעיות

✅ **Pre-Push** - לפני כל push:
- בודק build (npm run check)
- מונע push אם יש שגיאות

✅ **Post-Merge** - אחרי pull:
- מתקין dependencies אם package.json השתנה
- שומר על סביבת העבודה מעודכנת

## פקודות שימושיות נוספות 🛠️

```bash
# בדיקת שינויים מקומיים
git status

# ראיית היסטוריית commits
git log --oneline -10

# ביטול שינויים מקומיים (זהירות!)
git reset --hard HEAD

# שמירת שינויים זמנית
git stash
git stash pop

# החלפת branch
git checkout -b feature-new
```

## פתרון בעיות נפוצות 🔧

### בעיה: שגיאה ב-push - קונפליקטים

```bash
# 1. שמור שינויים מקומיים
git stash

# 2. משוך מהענן
git pull

# 3. החזר שינויים
git stash pop

# 4. פתור קונפליקטים ידנית
# 5. commit ו-push
```

### בעיה: שכחתי למשוך לפני שהתחלתי  

```bash
# אם עוד לא עשית commit:
git stash
npm run sync:pull
git stash pop

# אם כבר עשית commits:
npm run sync:pull  # יעשה merge אוטומטי
```

### בעיה: רוצה לבטל commit אחרון

```bash
# ביטול commit אבל שמירת השינויים
git reset --soft HEAD~1

# ביטול commit ומחיקת השינויים (זהירות!)
git reset --hard HEAD~1
```

## מבנה הקבצים 📁

```
remix-of-crm-p/
├── sync-push.ps1           # דחיפה לענן
├── sync-pull.ps1           # משיכה מהענן
├── sync-full.ps1           # סינכרון מלא
├── sync-status.ps1         # בדיקת סטטוס
├── install-hooks.ps1       # התקנת Git Hooks
├── .git/hooks/             # Git Hooks אוטומטיים
│   ├── pre-commit
│   ├── pre-push
│   └── post-merge
├── .env                    # הגדרות מקומיות
└── package.json            # פקודות npm
```

## הגדרות Supabase ⚙️

כדי להפעיל סינכרון מלא עם Supabase DB:

1. וודא שיש לך Supabase CLI מותקן:
```bash
npm install -g supabase
```

2. קשר את הפרויקט:
```bash
supabase link --project-ref holhnbxmupdqpbotrzke
```

3. משיכת schema מהענן:
```bash
supabase db pull
```

4. דחיפת migrations לענן:
```bash
supabase db push
```

## טיפים ⭐

1. **הרץ `npm run sync:status` באופן קבוע** - תדע איפה אתה עומד
2. **השתמש בהודעות commit ברורות** - יעזור למצוא דברים אחר כך
3. **עשה commit קטן ותכוף** - קל יותר לנהל
4. **משוך לפני שמתחיל לעבוד** - מונע קונפליקטים
5. **דחוף בסוף היום** - לא תאבד עבודה

## תמיכה 💬

רוצה לשנות משהו? כל הסקריפטים ניתנים לעריכה!
- `sync-*.ps1` - לוגיקת הסינכרון
- `package.json` - npm scripts
- `.git/hooks/*` - התנהגות אוטומטית

---

**נוצר עבור**: E-CONTROL CRM Pro  
**גרסה**: 1.0  
**תאריך**: פברואר 2026
