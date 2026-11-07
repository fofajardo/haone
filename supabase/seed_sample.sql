-- XXX: Seed data

INSERT INTO users (
  id,
  email,
  student_no,
  last_name,
  first_name,
  tags
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '<REPLACE THIS WITH EMAIL>',
  '1990-00000',
  'Juan',
  'Cruz',
  ARRAY['STUDENT']
) ON CONFLICT (email) DO NOTHING;

-- Internal System Accounts
INSERT INTO users (id, email, override_name) VALUES
  ('65eb6240-8200-48dd-a1b9-01c5994c77d7', '_funds', 'RESIDENCE HALL ASSOCIATION'),
  ('45ee82f7-103f-4607-80b8-6377a76441b7', '_imported', 'RESIDENCE HALL ASSOCIATION (IMPORTED)'),
  ('62383fc4-ce56-407e-adb0-962f0c77a132', '_dummy', 'DUMMY USER (FOR TESTING PURPOSES)')
ON CONFLICT (email) DO NOTHING;

INSERT INTO officers (
  id,
  position,
  name,
  nickname,
  email,
  status
) VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'President',
  'Juan Cruz',
  'Juan',
  '<REPLACE THIS WITH EMAIL>',
  'ACTIVE'
) ON CONFLICT (id) DO NOTHING;
