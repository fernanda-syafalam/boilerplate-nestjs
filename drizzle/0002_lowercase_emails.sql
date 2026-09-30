-- Fails on the unique constraint if two rows differ only by case; resolve those duplicates manually first.
UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");
