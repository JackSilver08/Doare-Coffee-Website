INSERT INTO admin_users
  (id, email, password_hash, password_salt, password_iterations, display_name, active)
VALUES
  (
    'ADMIN_DOARE_OWNER',
    'admin@dorae.com',
    '5bd3d79bd35841e540caf1bbfd8aaac69c2ac2aa6b6546a8867311ec6629a55f',
    '4402b9389552a20d02126198644624be',
    100000,
    'Dorae Owner',
    1
  )
ON CONFLICT(id) DO UPDATE SET
  email = excluded.email,
  password_hash = excluded.password_hash,
  password_salt = excluded.password_salt,
  password_iterations = excluded.password_iterations,
  display_name = excluded.display_name,
  active = 1,
  updated_at = CURRENT_TIMESTAMP;
