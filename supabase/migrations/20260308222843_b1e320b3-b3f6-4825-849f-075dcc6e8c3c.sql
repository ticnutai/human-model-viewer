
-- Auto-populate hebrew_name based on display_name keywords
UPDATE models SET hebrew_name = 'לב' WHERE (hebrew_name IS NULL OR hebrew_name = '') AND lower(display_name) ~ 'heart' AND NOT lower(display_name) ~ 'brain|lung|stomach|skeleton|muscle';
UPDATE models SET hebrew_name = 'מוח' WHERE (hebrew_name IS NULL OR hebrew_name = '') AND lower(display_name) ~ 'brain' AND NOT lower(display_name) ~ 'heart|lung|stomach|skeleton|muscle';
UPDATE models SET hebrew_name = 'ריאות' WHERE (hebrew_name IS NULL OR hebrew_name = '') AND lower(display_name) ~ 'lung' AND NOT lower(display_name) ~ 'heart|brain|stomach|skeleton|muscle';
UPDATE models SET hebrew_name = 'קיבה' WHERE (hebrew_name IS NULL OR hebrew_name = '') AND lower(display_name) ~ 'stomach' AND NOT lower(display_name) ~ 'heart|brain|lung|skeleton|muscle';
UPDATE models SET hebrew_name = 'עצם הזרוע' WHERE (hebrew_name IS NULL OR hebrew_name = '') AND lower(display_name) ~ 'humerus';
UPDATE models SET hebrew_name = 'יד' WHERE (hebrew_name IS NULL OR hebrew_name = '') AND lower(display_name) ~ 'hand';
UPDATE models SET hebrew_name = 'מוח + עין' WHERE (hebrew_name IS NULL OR hebrew_name = '') AND lower(display_name) ~ 'brain' AND lower(display_name) ~ 'eye';
UPDATE models SET hebrew_name = 'אנטומיה + קיבה + ריאות + לב' WHERE (hebrew_name IS NULL OR hebrew_name = '') AND lower(display_name) ~ 'anatomy' AND lower(display_name) ~ 'stomach|lungs|heart';
UPDATE models SET hebrew_name = 'אנטומיה' WHERE (hebrew_name IS NULL OR hebrew_name = '') AND lower(display_name) ~ 'anatomy' AND NOT lower(display_name) ~ 'heart|brain|lung|stomach';
