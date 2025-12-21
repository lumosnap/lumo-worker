-- Initialize database extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a test user for development (optional)
-- CREATE USER lumosnap_dev WITH PASSWORD 'dev_password';
-- GRANT ALL PRIVILEGES ON DATABASE lumosnap_dev TO lumosnap_dev;

-- Log current database info
SELECT current_database(), current_user, version();