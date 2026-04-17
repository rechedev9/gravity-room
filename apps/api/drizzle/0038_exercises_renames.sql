ALTER TABLE exercises RENAME COLUMN force TO force_type;
ALTER TABLE exercises RENAME COLUMN mechanic TO movement_mechanic;
ALTER TABLE exercises RENAME COLUMN created_by TO created_by_user_id;
ALTER TABLE exercises RENAME COLUMN is_preset TO is_system;
