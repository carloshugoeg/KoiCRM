-- Supabase production init: app_user (RLS) + admin_user (migrations/seeds).
-- Placeholders __APP_USER_PASSWORD__ and __ADMIN_USER_PASSWORD__ are replaced by bootstrap-production.sh.
-- Database is Supabase default: postgres

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    EXECUTE format('CREATE USER app_user WITH PASSWORD %L', '__APP_USER_PASSWORD__');
  ELSE
    EXECUTE format('ALTER USER app_user WITH PASSWORD %L', '__APP_USER_PASSWORD__');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_user') THEN
    EXECUTE format('CREATE USER admin_user WITH PASSWORD %L CREATEDB', '__ADMIN_USER_PASSWORD__');
  ELSE
    EXECUTE format('ALTER USER admin_user WITH PASSWORD %L', '__ADMIN_USER_PASSWORD__');
  END IF;
END
$$;

ALTER ROLE admin_user BYPASSRLS;
GRANT app_user TO postgres;

GRANT CONNECT ON DATABASE postgres TO app_user;
GRANT CONNECT ON DATABASE postgres TO admin_user;

GRANT ALL PRIVILEGES ON SCHEMA public TO admin_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO admin_user;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin_user;
