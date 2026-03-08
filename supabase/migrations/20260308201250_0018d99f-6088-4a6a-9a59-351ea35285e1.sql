
-- Seed layer definitions into model_mesh_mappings (model_url = 'layers')
INSERT INTO public.model_mesh_mappings (model_url, mesh_key, name, summary, icon, system, facts) VALUES
('layers', 'skeleton', 'Skeleton', 'שלד', '🦴', 'skeleton', '{"color":"hsl(40,30%,85%)","peelDirection":[0,0,-0.8]}'),
('layers', 'muscles', 'Muscles', 'שרירים', '💪', 'muscles', '{"color":"hsl(0,60%,55%)","peelDirection":[-0.6,0,-0.3]}'),
('layers', 'organs', 'Organs', 'איברים', '🫀', 'organs', '{"color":"hsl(350,50%,50%)","peelDirection":[0,0,0.5]}'),
('layers', 'vessels', 'Vessels', 'כלי דם', '🩸', 'vessels', '{"color":"hsl(0,80%,45%)","peelDirection":[0.6,0,-0.3]}')
ON CONFLICT (mesh_key, model_url) DO UPDATE SET name=EXCLUDED.name, summary=EXCLUDED.summary, icon=EXCLUDED.icon, system=EXCLUDED.system, facts=EXCLUDED.facts, updated_at=now();

-- Seed all interactive organ shapes (model_url = 'interactive')
INSERT INTO public.model_mesh_mappings (model_url, mesh_key, name, summary, icon, system, facts) VALUES
-- HEAD
('interactive', 'brain_0', 'Brain', 'מוח', '🧠', 'organs', '{"key":"brain","position":[0,2.08,0.02],"scale":[0.28,0.22,0.26],"color":"#e8a0bf","hoverColor":"#f0b8d0","geometry":"ellipsoid","layer":1}'),
('interactive', 'skull_1', 'Skull', 'גולגולת', '💀', 'skeleton', '{"key":"skull","position":[0,2.02,0],"scale":[0.34,0.32,0.32],"color":"#f5f0e8","hoverColor":"#fff8ee","geometry":"ellipsoid","layer":0}'),
-- NECK
('interactive', 'bone_neck', 'Neck Vertebrae', 'חוליות צוואר', '🦴', 'skeleton', '{"key":"bone","position":[0,1.55,0.02],"scale":[0.035,0.2,0.035],"color":"#d0c8b8","hoverColor":"#e0d8c8","geometry":"cylinder"}'),
-- RIBS
('interactive', 'rib_r1', 'Right Rib 1', 'צלע ימין 1', '🦴', 'skeleton', '{"key":"bone","position":[0.22,1.1,0.08],"scale":[0.02,0.015,0.12],"color":"#e8dcc8","hoverColor":"#f0e8d8","geometry":"ellipsoid","rotation":[0,0,0.3]}'),
('interactive', 'rib_l1', 'Left Rib 1', 'צלע שמאל 1', '🦴', 'skeleton', '{"key":"bone","position":[-0.22,1.1,0.08],"scale":[0.02,0.015,0.12],"color":"#e8dcc8","hoverColor":"#f0e8d8","geometry":"ellipsoid","rotation":[0,0,-0.3]}'),
('interactive', 'rib_r2', 'Right Rib 2', 'צלע ימין 2', '🦴', 'skeleton', '{"key":"bone","position":[0.25,0.95,0.08],"scale":[0.02,0.015,0.13],"color":"#e8dcc8","hoverColor":"#f0e8d8","geometry":"ellipsoid","rotation":[0,0,0.25]}'),
('interactive', 'rib_l2', 'Left Rib 2', 'צלע שמאל 2', '🦴', 'skeleton', '{"key":"bone","position":[-0.25,0.95,0.08],"scale":[0.02,0.015,0.13],"color":"#e8dcc8","hoverColor":"#f0e8d8","geometry":"ellipsoid","rotation":[0,0,-0.25]}'),
('interactive', 'rib_r3', 'Right Rib 3', 'צלע ימין 3', '🦴', 'skeleton', '{"key":"bone","position":[0.27,0.8,0.07],"scale":[0.02,0.015,0.14],"color":"#e8dcc8","hoverColor":"#f0e8d8","geometry":"ellipsoid","rotation":[0,0,0.2]}'),
('interactive', 'rib_l3', 'Left Rib 3', 'צלע שמאל 3', '🦴', 'skeleton', '{"key":"bone","position":[-0.27,0.8,0.07],"scale":[0.02,0.015,0.14],"color":"#e8dcc8","hoverColor":"#f0e8d8","geometry":"ellipsoid","rotation":[0,0,-0.2]}'),
('interactive', 'rib_r4', 'Right Rib 4', 'צלע ימין 4', '🦴', 'skeleton', '{"key":"bone","position":[0.26,0.65,0.06],"scale":[0.02,0.015,0.13],"color":"#e8dcc8","hoverColor":"#f0e8d8","geometry":"ellipsoid","rotation":[0,0,0.15]}'),
('interactive', 'rib_l4', 'Left Rib 4', 'צלע שמאל 4', '🦴', 'skeleton', '{"key":"bone","position":[-0.26,0.65,0.06],"scale":[0.02,0.015,0.13],"color":"#e8dcc8","hoverColor":"#f0e8d8","geometry":"ellipsoid","rotation":[0,0,-0.15]}'),
-- LUNGS
('interactive', 'lung_r', 'Right Lung', 'ריאה ימנית', '🫁', 'organs', '{"key":"lung","position":[0.22,0.88,0.01],"scale":[0.18,0.32,0.16],"color":"#f5a0a0","hoverColor":"#ffb8b8","geometry":"ellipsoid"}'),
('interactive', 'lung_l', 'Left Lung', 'ריאה שמאלית', '🫁', 'organs', '{"key":"lung","position":[-0.22,0.88,0.01],"scale":[0.2,0.35,0.17],"color":"#f0989e","hoverColor":"#ffb0b8","geometry":"ellipsoid"}'),
-- HEART
('interactive', 'heart_0', 'Heart', 'לב', '❤️', 'organs', '{"key":"heart","position":[0.06,0.78,0.06],"scale":[0.1,0.11,0.09],"color":"#cc3355","hoverColor":"#ee4466","geometry":"sphere","rotation":[0,0,0.2]}'),
-- VESSELS
('interactive', 'aorta_main', 'Aorta', 'אבי העורקים', '🩸', 'vessels', '{"key":"aorta","position":[0.03,0.55,-0.02],"scale":[0.025,0.55,0.025],"color":"#dd2244","hoverColor":"#ee3355","geometry":"cylinder"}'),
('interactive', 'aorta_arch', 'Aortic Arch', 'קשת אבי העורקים', '🩸', 'vessels', '{"key":"aorta","position":[0.03,0.85,-0.02],"scale":[0.06,0.02,0.025],"color":"#cc1133","hoverColor":"#dd2244","geometry":"ellipsoid"}'),
('interactive', 'vena_cava', 'Vena Cava', 'וריד נבוב', '🩸', 'vessels', '{"key":"aorta","position":[-0.04,0.5,-0.03],"scale":[0.02,0.5,0.02],"color":"#4466aa","hoverColor":"#5577cc","geometry":"cylinder"}'),
-- DIAPHRAGM
('interactive', 'diaphragm_0', 'Diaphragm', 'סרעפת', '💪', 'muscles', '{"key":"diaphragm","position":[0,0.5,0],"scale":[0.42,0.025,0.24],"color":"#d4886b","hoverColor":"#e09a7d","geometry":"ellipsoid"}'),
-- LIVER
('interactive', 'liver_main', 'Liver', 'כבד', '🫀', 'organs', '{"key":"liver","position":[-0.16,0.36,0.04],"scale":[0.26,0.1,0.16],"color":"#8b3a3a","hoverColor":"#a04848","geometry":"ellipsoid","rotation":[0,0.2,-0.15]}'),
('interactive', 'gallbladder_0', 'Gallbladder', 'כיס מרה', '🫀', 'organs', '{"key":"liver","position":[-0.06,0.28,0.08],"scale":[0.035,0.05,0.025],"color":"#5a8a3a","hoverColor":"#6a9a4a","geometry":"ellipsoid"}'),
-- STOMACH
('interactive', 'stomach_main', 'Stomach', 'קיבה', '🫃', 'organs', '{"key":"stomach","position":[0.12,0.3,0.06],"scale":[0.13,0.1,0.09],"color":"#d4a07a","hoverColor":"#e0b090","geometry":"ellipsoid","rotation":[0,0,0.35]}'),
('interactive', 'stomach_pylorus', 'Pylorus', 'שוער הקיבה', '🫃', 'organs', '{"key":"stomach","position":[0.1,0.22,0.06],"scale":[0.06,0.08,0.06],"color":"#c89068","hoverColor":"#d8a078","geometry":"ellipsoid","rotation":[0,0,0.5]}'),
-- SPLEEN
('interactive', 'spleen_0', 'Spleen', 'טחול', '🫀', 'organs', '{"key":"spleen","position":[0.32,0.32,-0.04],"scale":[0.07,0.055,0.04],"color":"#7b2d5f","hoverColor":"#9a3d75","geometry":"ellipsoid","rotation":[0,0,0.3]}'),
-- PANCREAS
('interactive', 'pancreas_0', 'Pancreas', 'לבלב', '🫀', 'organs', '{"key":"pancreas","position":[0,0.2,-0.01],"scale":[0.2,0.035,0.04],"color":"#e8c878","hoverColor":"#f0d888","geometry":"ellipsoid"}'),
-- KIDNEYS
('interactive', 'kidney_r', 'Right Kidney', 'כליה ימנית', '🫘', 'organs', '{"key":"kidney","position":[0.16,0.1,-0.08],"scale":[0.06,0.09,0.045],"color":"#a04040","hoverColor":"#c05555","geometry":"ellipsoid","rotation":[0,0,0.1]}'),
('interactive', 'kidney_l', 'Left Kidney', 'כליה שמאלית', '🫘', 'organs', '{"key":"kidney","position":[-0.16,0.1,-0.08],"scale":[0.06,0.09,0.045],"color":"#a04040","hoverColor":"#c05555","geometry":"ellipsoid","rotation":[0,0,-0.1]}'),
('interactive', 'adrenal_r', 'Right Adrenal', 'יותרת כליה ימנית', '🫘', 'organs', '{"key":"kidney","position":[0.16,0.17,-0.07],"scale":[0.035,0.02,0.025],"color":"#c89040","hoverColor":"#d8a050","geometry":"ellipsoid"}'),
('interactive', 'adrenal_l', 'Left Adrenal', 'יותרת כליה שמאלית', '🫘', 'organs', '{"key":"kidney","position":[-0.16,0.17,-0.07],"scale":[0.035,0.02,0.025],"color":"#c89040","hoverColor":"#d8a050","geometry":"ellipsoid"}'),
('interactive', 'ureter_r', 'Right Ureter', 'שופכן ימני', '🫘', 'organs', '{"key":"kidney","position":[0.12,-0.18,-0.04],"scale":[0.012,0.32,0.012],"color":"#c88080","hoverColor":"#d89898","geometry":"cylinder","rotation":[0,0,0.08]}'),
('interactive', 'ureter_l', 'Left Ureter', 'שופכן שמאלי', '🫘', 'organs', '{"key":"kidney","position":[-0.12,-0.18,-0.04],"scale":[0.012,0.32,0.012],"color":"#c88080","hoverColor":"#d89898","geometry":"cylinder","rotation":[0,0,-0.08]}'),
-- COLON
('interactive', 'colon_asc', 'Ascending Colon', 'מעי גס עולה', '🫀', 'organs', '{"key":"colon","position":[-0.22,-0.08,0.02],"scale":[0.04,0.25,0.04],"color":"#c88888","hoverColor":"#d8a0a0","geometry":"cylinder"}'),
('interactive', 'colon_trans', 'Transverse Colon', 'מעי גס רוחבי', '🫀', 'organs', '{"key":"colon","position":[0,0.05,0.02],"scale":[0.22,0.04,0.04],"color":"#c88888","hoverColor":"#d8a0a0","geometry":"cylinder","rotation":[0,0,1.5707963267948966]}'),
('interactive', 'colon_desc', 'Descending Colon', 'מעי גס יורד', '🫀', 'organs', '{"key":"colon","position":[0.22,-0.08,0.02],"scale":[0.04,0.25,0.04],"color":"#c88888","hoverColor":"#d8a0a0","geometry":"cylinder"}'),
('interactive', 'colon_sig', 'Sigmoid Colon', 'מעי גס סיגמואידלי', '🫀', 'organs', '{"key":"colon","position":[0.12,-0.28,0.03],"scale":[0.04,0.1,0.04],"color":"#c08080","hoverColor":"#d09898","geometry":"ellipsoid","rotation":[0,0,0.5]}'),
-- SMALL INTESTINE
('interactive', 'intestine_main', 'Small Intestine', 'מעי דק', '🫀', 'organs', '{"key":"intestine","position":[0,-0.12,0.04],"scale":[0.17,0.16,0.1],"color":"#e8a8a8","hoverColor":"#f0baba","geometry":"ellipsoid"}'),
('interactive', 'intestine_r', 'Jejunum', 'ג׳ג׳ונום', '🫀', 'organs', '{"key":"intestine","position":[0.06,-0.18,0.05],"scale":[0.1,0.08,0.06],"color":"#e0a0a0","hoverColor":"#f0b0b0","geometry":"ellipsoid"}'),
('interactive', 'intestine_l', 'Ileum', 'אילאום', '🫀', 'organs', '{"key":"intestine","position":[-0.06,-0.1,0.05],"scale":[0.08,0.1,0.06],"color":"#e4a4a4","hoverColor":"#f4b4b4","geometry":"ellipsoid"}'),
-- BLADDER
('interactive', 'bladder_0', 'Bladder', 'שלפוחית השתן', '🫀', 'organs', '{"key":"bladder","position":[0,-0.42,0.06],"scale":[0.08,0.07,0.065],"color":"#a0c8e0","hoverColor":"#b0d8f0","geometry":"sphere"}'),
-- PELVIS
('interactive', 'pelvis_r', 'Right Pelvis', 'אגן ימין', '🦴', 'skeleton', '{"key":"bone","position":[0.15,-0.38,0],"scale":[0.12,0.1,0.04],"color":"#e0d8c8","hoverColor":"#f0e8d8","geometry":"ellipsoid","rotation":[0,0,-0.4]}'),
('interactive', 'pelvis_l', 'Left Pelvis', 'אגן שמאל', '🦴', 'skeleton', '{"key":"bone","position":[-0.15,-0.38,0],"scale":[0.12,0.1,0.04],"color":"#e0d8c8","hoverColor":"#f0e8d8","geometry":"ellipsoid","rotation":[0,0,0.4]}'),
-- SPINE
('interactive', 'spine_main', 'Spine', 'עמוד שדרה', '🦴', 'skeleton', '{"key":"bone","position":[0,0.5,-0.14],"scale":[0.045,1.3,0.045],"color":"#e8e0d0","hoverColor":"#f0ece0","geometry":"cylinder"}'),
('interactive', 'disc_1', 'Disc T1', 'דיסק 1', '🦴', 'skeleton', '{"key":"bone","position":[0,1.0,-0.14],"scale":[0.06,0.015,0.06],"color":"#d8d0c0","hoverColor":"#e8e0d0","geometry":"cylinder"}'),
('interactive', 'disc_2', 'Disc T5', 'דיסק 5', '🦴', 'skeleton', '{"key":"bone","position":[0,0.7,-0.14],"scale":[0.06,0.015,0.06],"color":"#d8d0c0","hoverColor":"#e8e0d0","geometry":"cylinder"}'),
('interactive', 'disc_3', 'Disc T9', 'דיסק 9', '🦴', 'skeleton', '{"key":"bone","position":[0,0.4,-0.14],"scale":[0.06,0.015,0.06],"color":"#d8d0c0","hoverColor":"#e8e0d0","geometry":"cylinder"}'),
('interactive', 'disc_4', 'Disc L2', 'דיסק L2', '🦴', 'skeleton', '{"key":"bone","position":[0,0.1,-0.14],"scale":[0.06,0.015,0.06],"color":"#d8d0c0","hoverColor":"#e8e0d0","geometry":"cylinder"}'),
('interactive', 'disc_5', 'Disc L5', 'דיסק L5', '🦴', 'skeleton', '{"key":"bone","position":[0,-0.2,-0.14],"scale":[0.06,0.015,0.06],"color":"#d8d0c0","hoverColor":"#e8e0d0","geometry":"cylinder"}'),
-- MUSCLES
('interactive', 'bicep_r', 'Right Bicep', 'זרוע ימין', '💪', 'muscles', '{"key":"muscle","position":[0.52,0.75,0.02],"scale":[0.07,0.2,0.07],"color":"#c05050","hoverColor":"#d06060","geometry":"ellipsoid"}'),
('interactive', 'bicep_l', 'Left Bicep', 'זרוע שמאל', '💪', 'muscles', '{"key":"muscle","position":[-0.52,0.75,0.02],"scale":[0.07,0.2,0.07],"color":"#c05050","hoverColor":"#d06060","geometry":"ellipsoid"}'),
('interactive', 'forearm_r', 'Right Forearm', 'אמה ימנית', '💪', 'muscles', '{"key":"muscle","position":[0.56,0.45,0.01],"scale":[0.05,0.18,0.05],"color":"#b04545","hoverColor":"#c05555","geometry":"ellipsoid"}'),
('interactive', 'forearm_l', 'Left Forearm', 'אמה שמאלית', '💪', 'muscles', '{"key":"muscle","position":[-0.56,0.45,0.01],"scale":[0.05,0.18,0.05],"color":"#b04545","hoverColor":"#c05555","geometry":"ellipsoid"}'),
-- SHOULDERS
('interactive', 'shoulder_r', 'Right Shoulder', 'כתף ימין', '🦴', 'skeleton', '{"key":"bone","position":[0.4,1.15,0],"scale":[0.05,0.05,0.05],"color":"#e0d8c8","hoverColor":"#f0e8d8","geometry":"sphere"}'),
('interactive', 'shoulder_l', 'Left Shoulder', 'כתף שמאל', '🦴', 'skeleton', '{"key":"bone","position":[-0.4,1.15,0],"scale":[0.05,0.05,0.05],"color":"#e0d8c8","hoverColor":"#f0e8d8","geometry":"sphere"}')
ON CONFLICT (mesh_key, model_url) DO UPDATE SET name=EXCLUDED.name, summary=EXCLUDED.summary, icon=EXCLUDED.icon, system=EXCLUDED.system, facts=EXCLUDED.facts, updated_at=now();
