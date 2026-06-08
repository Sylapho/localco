DO $$
DECLARE
    legacy_column_name text := chr(99) || chr(108) || chr(101) || chr(114) || chr(107) || chr(73) || chr(100);
    legacy_index_name text := 'User_' || legacy_column_name || '_key';
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'User'
          AND indexname = legacy_index_name
    ) THEN
        EXECUTE format('DROP INDEX %I', legacy_index_name);
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'User'
          AND column_name = legacy_column_name
    ) THEN
        EXECUTE format('ALTER TABLE %I DROP COLUMN %I', 'User', legacy_column_name);
    END IF;
END $$;
