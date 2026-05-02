-- Create app user (no BYPASSRLS - used by application)
CREATE USER app_user WITH PASSWORD 'app_pass';

-- Create admin user (BYPASSRLS - used for migrations/seeds only)
CREATE USER admin_user WITH PASSWORD 'admin_pass';
ALTER ROLE admin_user BYPASSRLS;

-- Grant database access
GRANT ALL PRIVILEGES ON DATABASE koicrm TO admin_user;
GRANT CONNECT ON DATABASE koicrm TO app_user;

-- Grant schema access for app_user
GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_user;
