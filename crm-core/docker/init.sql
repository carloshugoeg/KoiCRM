-- Create app user (no BYPASSRLS - used by application)
CREATE USER app_user WITH PASSWORD 'app_pass';

-- Create admin user (BYPASSRLS - used for migrations/seeds only)
CREATE USER admin_user WITH PASSWORD 'admin_pass' CREATEDB;
ALTER ROLE admin_user BYPASSRLS;

-- Allow admin_user to assume app_user via SET ROLE / SET LOCAL ROLE.
-- The app hardens RLS by running `SET LOCAL ROLE app_user` inside withTenant() when
-- DATABASE_SET_ROLE=app_user. Integration tests mock the db client to admin_user, so the
-- connecting role must be a member of app_user for that SET ROLE to succeed (42501 otherwise).
GRANT app_user TO admin_user;

-- Grant database access
GRANT ALL PRIVILEGES ON DATABASE koicrm TO admin_user;
GRANT CONNECT ON DATABASE koicrm TO app_user;

-- Grant schema access for admin_user (migrations)
GRANT ALL PRIVILEGES ON SCHEMA public TO admin_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin_user;

-- Grant schema access for app_user
GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;
