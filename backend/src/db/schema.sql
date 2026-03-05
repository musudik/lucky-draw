-- Lucky Draw Event Management System - Database Schema
-- Executed on every backend startup via initDb(); all statements are idempotent.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Event Managers
CREATE TABLE IF NOT EXISTS event_managers (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  UNIQUE NOT NULL,
  password_hash TEXT          NOT NULL,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  manager_id  INT           REFERENCES event_managers(id) ON DELETE CASCADE,
  name        VARCHAR(200)  NOT NULL,
  description TEXT,
  venue       VARCHAR(200),
  event_date  DATE,
  status      VARCHAR(20)   NOT NULL DEFAULT 'active',
  qr_token    UUID          DEFAULT gen_random_uuid() UNIQUE,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- Migration: add status column if table was created without it
ALTER TABLE events ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

-- Participants
CREATE TABLE IF NOT EXISTS participants (
  id                SERIAL PRIMARY KEY,
  event_id          INT           REFERENCES events(id) ON DELETE CASCADE,
  name              VARCHAR(200)  NOT NULL,
  email             VARCHAR(150)  NOT NULL DEFAULT '',
  phone             VARCHAR(30)   NOT NULL DEFAULT '',
  family_status     VARCHAR(60),
  services_required JSONB         DEFAULT '[]',
  consent           BOOLEAN       NOT NULL DEFAULT FALSE,
  registered_at     TIMESTAMPTZ   DEFAULT NOW()
);

-- Migration: add columns that may be missing from older installs
ALTER TABLE participants ADD COLUMN IF NOT EXISTS email             VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE participants ADD COLUMN IF NOT EXISTS phone             VARCHAR(30)  NOT NULL DEFAULT '';
ALTER TABLE participants ADD COLUMN IF NOT EXISTS family_status     VARCHAR(60);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS services_required JSONB        DEFAULT '[]';
ALTER TABLE participants ADD COLUMN IF NOT EXISTS consent           BOOLEAN      NOT NULL DEFAULT FALSE;

-- Migration: add unique (event_id, email) constraint idempotently
-- DROP + ADD is safe: DROP IF EXISTS never errors; ADD re-creates it cleanly.
ALTER TABLE participants DROP CONSTRAINT IF EXISTS participants_event_id_email_key;
ALTER TABLE participants ADD  CONSTRAINT participants_event_id_email_key UNIQUE (event_id, email);

-- Sponsors
CREATE TABLE IF NOT EXISTS sponsors (
  id        SERIAL PRIMARY KEY,
  event_id  INT           REFERENCES events(id) ON DELETE CASCADE,
  name      VARCHAR(200)  NOT NULL,
  logo_url  TEXT
);

-- Prizes
CREATE TABLE IF NOT EXISTS prizes (
  id          SERIAL PRIMARY KEY,
  event_id    INT           REFERENCES events(id) ON DELETE CASCADE,
  sponsor_id  INT           REFERENCES sponsors(id) ON DELETE SET NULL,
  rank        INT           NOT NULL CHECK (rank > 0),
  description VARCHAR(300)  NOT NULL,
  UNIQUE (event_id, rank)
);

-- Winners
CREATE TABLE IF NOT EXISTS winners (
  id             SERIAL PRIMARY KEY,
  event_id       INT         REFERENCES events(id) ON DELETE CASCADE,
  participant_id INT         REFERENCES participants(id),
  prize_id       INT         REFERENCES prizes(id) ON DELETE SET NULL,
  won_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, participant_id)
);
