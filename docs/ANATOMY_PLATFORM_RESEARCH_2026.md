# מחקר מקצועי — פלטפורמות אנטומיה תלת־ממד בקוד פתוח (2026)

## מטרה
לבנות מסלול מקצועי לשדרוג `human-model-viewer` על בסיס מקורות פתוחים, תוך עמידה ברישוי והכנה לפרודקשן.

---

## תקציר מנהלים
- **המלצה מרכזית:** לשלב **3D Slicer + NIH 3D + Open Anatomy**, ולהוסיף **BodyParts3D** לשכבת תתי־איברים/אונטולוגיה.
- **למה:** זה נותן שילוב של כלי authoring חזקים, מאגר מודלים גדול, וארכיטקטורת atlas פתוחה.
- **מה להיזהר:** רישוי פר־מודל (NIH), Share-Alike (BodyParts3D), ורישיונות נגזרים/מוגבלים ב־MMHuman3D.
- **מסקנה עסקית:** ל־MVP מקצועי פתוח — להתחיל עם stack פתוח. ל־API מסחרי מוכן ומהיר — BioDigital (בתשלום) כאופציית enterprise.

---

## ממצאים לפי פרויקט

## 1) Open Anatomy Project
**התאמה:** גבוהה לאתר חינוכי עם אטלס רב-לשוני.  
**חוזקות:**
- ארכיטקטורת אטלס סמנטית (JSON-LD / קונספט שכבות / קישורים).
- גישה קהילתית פתוחה ליצירה ושיתוף אטלסים.
- כיוון ברור למודולריות ותרגומים.

**מגבלות:**
- לפי FAQ: עדיין ברמת prototype/proof-of-concept.
- אין בהכרח SLA של מוצר מסחרי.
- צריך לבדוק רישוי פר-אטלס/נכס ולא להניח רישיון אחיד.

**מקורות:**
- https://www.openanatomy.org/
- https://www.openanatomy.org/technology.html
- https://www.openanatomy.org/faq.html

---

## 2) BodyParts3D
**התאמה:** גבוהה לשמות תתי־מבנים וקישור לאונטולוגיה (FMA).  
**חוזקות:**
- פירוק אנטומי עמוק מאוד למבנים קטנים.
- שימושי ל־annotation pins מקצועיים.
- קישוריות לקונספטים ב־FMA.

**מגבלות:**
- Workflow ישן יחסית ודורש המרה/ניקוי pipeline.
- רישוי Share-Alike (CC BY-SA 2.1 JP) מחייב ניהול הפצה נגזרת.

**מקור:**
- https://lifesciencedb.jp/bp3d/

---

## 3) NIH 3D Model Library
**התאמה:** גבוהה כמקור מודלים מרכזי.  
**חוזקות:**
- מאגר גדול מאוד (אלפי מודלים).
- מאגר קהילתי פעיל.
- מסלול טוב לתוכן חינוכי/מחקרי.

**מגבלות קריטיות:**
- **רישוי פר־מודל**: לא כל מודל באותו רישיון.
- חובה לבדוק תנאים לכל entry לפני שימוש מסחרי/הפצה.
- לא כלי לאבחון רפואי.

**מקורות:**
- https://3d.nih.gov/
- https://3d.nih.gov/terms

---

## 4) 3D Slicer
**התאמה:** גבוהה מאוד ל־authoring pipeline.  
**חוזקות:**
- פלטפורמת עיבוד רפואי בשלה (סגמנטציה, רישום, ניקוי, יצוא).
- אוטומציה עם Python.
- רישוי BSD-style וגישה פרו-מסחרית.

**מגבלות:**
- כלי desktop ולא רכיב runtime לדפדפן.
- דורש pipeline בנפרד לייצוא assets ל-web.

**מקורות:**
- https://www.slicer.org/
- https://slicer.readthedocs.io/en/latest/user_guide/about.html#license

---

## 5) MMHuman3D
**התאמה:** בינונית למחקר, נמוכה יחסית לתוכן אנטומי חינוכי מוכן.  
**חוזקות:**
- Framework חזק למודלים פרמטריים של גוף האדם.
- Apache-2.0 בליבה.

**סיכון רישוי:**
- תלויות רבות עם רישיונות נוספים (כולל non-commercial).
- נדרש שער רישוי מחמיר לפני שימוש בפרודקשן מסחרי.

**מקורות:**
- https://github.com/open-mmlab/mmhuman3d
- https://github.com/open-mmlab/mmhuman3d/blob/main/docs/additional_licenses.md

---

## 6) xeokit SDK
**התאמה:** טובה לשדרוג מנוע צפייה/אינטראקציות גדולות, אך לא ספציפי לאנטומיה.  
**חוזקות:**
- ביצועים גבוהים, מערכת plugins, כלים של annotation/measurement.
- מתאים לסצנות כבדות.

**סיכון רישוי:**
- מודל open ב־AGPL-3.0 (מחייב לשים לב לקופילפט ברמת מערכת).
- יש מסלול רישוי פרטי מסחרי.

**מקור:**
- https://xeokit.io/

---

## 7) BioDigital (מסחרי)
**התאמה:** גבוהה למסלול enterprise מהיר.  
**חוזקות:**
- API/פלטפורמה מוכנה עם תוכן מובנה.
- אינטגרציה מהירה יחסית, תמיכה עסקית.

**מגבלות:**
- לא קוד פתוח.
- תנאי שימוש ורישוי תוכן מגבילים (העתקה/הפצה).
- תלות ספק.

**מקורות:**
- https://www.biodigital.com/
- https://www.biodigital.com/terms

---

## טבלת החלטה מקצועית (לפרויקט שלך)
| פרויקט | תפקיד מוצע | סיכון רישוי | התאמה לאתר | המלצה |
|---|---|---:|---:|---|
| 3D Slicer | Authoring Pipeline | נמוך | גבוה מאוד | ✅ חובה |
| NIH 3D | מקור מודלים | בינוני (פר מודל) | גבוה | ✅ חובה עם בקרת רישוי |
| Open Anatomy | אטלס סמנטי / שכבות ידע | בינוני | גבוה | ✅ לשלב בהדרגה |
| BodyParts3D | תתי־איברים ואונטולוגיה | בינוני | גבוה | ✅ לשלב לדיוק |
| MMHuman3D | R&D פרמטרי | גבוה | בינוני | ⚠️ לשימוש מחקרי מבוקר |
| xeokit | מנוע Viewer חלופי | גבוה (AGPL) | בינוני-גבוה | ⚠️ רק אם צריך ביצועים קיצוניים |
| BioDigital | API מסחרי מוכן | תלוי חוזה | גבוה | 💰 אופציה מסחרית |

---

## ארכיטקטורה מוצעת לשדרוג מקצועי
## שכבה 1: Asset Pipeline (Offline)
1. יבוא raw models מ־NIH/Open sources.
2. עיבוד ב־3D Slicer (סגמנטציה, ניקוי, הפחתת פוליגונים).
3. יצוא ל־GLB + metadata JSON.
4. רישום מקורות + רישיון + attribution לכל קובץ.

## שכבה 2: Semantic Anatomy Layer
1. מיפוי איברים ל־Terminologia Anatomica / FMA IDs.
2. שילוב קונספטים מ־BodyParts3D/Open Anatomy.
3. שמירה כ־JSON-LD/JSON normalized לשכבת חיפוש וקישורים.

## שכבה 3: Web Runtime (האתר)
1. Viewer אינטראקטיבי (קיים אצלך) + pins + layers.
2. multilingual content (כבר הוטמע חלקית).
3. מקור אמת אחד לשמות/מערכות/Latin + annotations לפי ID.

## שכבה 4: Compliance & Governance
1. manifest רישוי לכל asset.
2. CI check שחוסם build אם רישיון חסר.
3. audit log של מקור-קובץ-גרסה.

---

## פורומים מקצועיים מומלצים למחקר מתמשך
- 3D Slicer Discourse: https://discourse.slicer.org/
- OpenMMLab discussions: https://github.com/open-mmlab/mmhuman3d/discussions
- של קהילות pmndrs / three.js (viewer/runtime)
- קהילות רפואיות/דימות סביב open atlases

---

## תוכנית ביצוע מדורגת
## שלב A (מיידי, 1–2 שבועות)
- לבנות `asset-license-manifest.json`.
- לבחור 20–30 מודלים ראשונים עם אישור רישוי.
- להשלים bilingual + latin + body-system לכל איבר ראשי.

## שלב B (2–4 שבועות)
- pipeline חצי-אוטומטי לייצוא מ־Slicer ל־GLB metadata.
- שכבת ontology IDs (TA2/FMA) לכל איבר ותתי־איברים.
- מנגנון pin generation מ־metadata.

## שלב C (4–8 שבועות)
- בדיקות איכות: FPS, גודל קבצים, תקינות רישוי.
- השוואת מנועים (r3f מול xeokit POC).
- פתיחת מסלול enterprise אופציונלי (BioDigital) רק אם KPI עסקי מחייב.

---

## מדיניות רישוי מומלצת לפרויקט
- אין הכנסת מודל בלי שדה: `source`, `license`, `attribution`, `allowed_use`.
- “Unknown license” = חסימה אוטומטית בפרסום.
- מודלים עם non-commercial יסומנו `research_only=true` ולא יכנסו לפרודקשן מסחרי.

---

## הערה משפטית קצרה
המסמך טכני ואינו ייעוץ משפטי. לפני פרודקשן מסחרי יש לבצע בדיקה משפטית פורמלית של רישיונות הנכסים שנבחרו.
