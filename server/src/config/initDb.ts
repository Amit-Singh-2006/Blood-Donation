import { createHash } from 'crypto';
import pool from './db';

const initDb = async () => {
  const schemaQuery = `
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'donor', 'hospital')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Donors Table (Enhanced)
    CREATE TABLE IF NOT EXISTS donors (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      blood_group VARCHAR(10) CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
      city VARCHAR(100),
      phone VARCHAR(20),
      dob DATE,
      gender VARCHAR(20),
      last_donation_date DATE,
      is_eligible BOOLEAN DEFAULT TRUE,
      latitude DECIMAL(9,6),
      longitude DECIMAL(9,6),
      xp_points INTEGER DEFAULT 0,
      current_level INTEGER DEFAULT 1,
      badges JSONB DEFAULT '[]'
    );

    -- Hospitals Table
    CREATE TABLE IF NOT EXISTS hospitals (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      hospital_name VARCHAR(255) NOT NULL,
      city VARCHAR(100),
      contact_number VARCHAR(20),
      latitude DECIMAL(9,6),
      longitude DECIMAL(9,6)
    );

    -- Donations Table
    CREATE TABLE IF NOT EXISTS donations (
      id SERIAL PRIMARY KEY,
      donor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      hospital_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
      units INTEGER NOT NULL CHECK (units > 0),
      xp_earned INTEGER DEFAULT 0
    );

    -- Blood Inventory Table (New)
    CREATE TABLE IF NOT EXISTS blood_inventory (
      id SERIAL PRIMARY KEY,
      hospital_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      blood_group VARCHAR(10) CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
      units INTEGER NOT NULL DEFAULT 0 CHECK (units >= 0),
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(hospital_id, blood_group)
    );

    -- Blood Requests Table (New)
    CREATE TABLE IF NOT EXISTS blood_requests (
      id SERIAL PRIMARY KEY,
      hospital_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      blood_group VARCHAR(10) CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
      units_required INTEGER NOT NULL CHECK (units_required > 0),
      urgency VARCHAR(20) CHECK (urgency IN ('Normal', 'Emergency', 'Urgent')),
      status VARCHAR(20) DEFAULT 'Open' CHECK (status IN ('Open', 'Fulfilled', 'Completed', 'Exhausted', 'Cancelled')),
      latitude DECIMAL(9,6),
      longitude DECIMAL(9,6),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Notifications Table
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50),
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Add missing columns to existing tables if they were created previously
    DO $$ 
    BEGIN 
      -- Donors table updates
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='donors' AND column_name='latitude') THEN
        ALTER TABLE donors ADD COLUMN latitude DECIMAL(9,6);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='donors' AND column_name='longitude') THEN
        ALTER TABLE donors ADD COLUMN longitude DECIMAL(9,6);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='donors' AND column_name='xp_points') THEN
        ALTER TABLE donors ADD COLUMN xp_points INTEGER DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='donors' AND column_name='current_level') THEN
        ALTER TABLE donors ADD COLUMN current_level INTEGER DEFAULT 1;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='donors' AND column_name='badges') THEN
        ALTER TABLE donors ADD COLUMN badges JSONB DEFAULT '[]';
      END IF;

      -- Hospitals table updates
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hospitals' AND column_name='latitude') THEN
        ALTER TABLE hospitals ADD COLUMN latitude DECIMAL(9,6);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='hospitals' AND column_name='longitude') THEN
        ALTER TABLE hospitals ADD COLUMN longitude DECIMAL(9,6);
      END IF;

      -- Donations table updates
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='donations' AND column_name='xp_earned') THEN
        ALTER TABLE donations ADD COLUMN xp_earned INTEGER DEFAULT 0;
      END IF;

      -- Blood Requests table updates
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='blood_requests' AND column_name='latitude') THEN
        ALTER TABLE blood_requests ADD COLUMN latitude DECIMAL(9,6);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='blood_requests' AND column_name='longitude') THEN
        ALTER TABLE blood_requests ADD COLUMN longitude DECIMAL(9,6);
      END IF;
    END $$;

    -- Hospital verification: only admin-verified hospitals can alert donors
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100);

    -- Link each request to the n8n donor network (tokens stay server-side)
    ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS patient_ref VARCHAR(40);
    ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS required_by TIMESTAMPTZ;
    ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS network_request_id INTEGER;
    ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS tracking_token VARCHAR(64);
    ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS hospital_token VARCHAR(64);
    ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS network_error TEXT;

    -- The network also closes requests as Completed or Exhausted
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blood_requests_status_check'
                 AND pg_get_constraintdef(oid) NOT LIKE '%Exhausted%') THEN
        ALTER TABLE blood_requests DROP CONSTRAINT blood_requests_status_check;
        ALTER TABLE blood_requests ADD CONSTRAINT blood_requests_status_check
          CHECK (status IN ('Open', 'Fulfilled', 'Completed', 'Exhausted', 'Cancelled'));
      END IF;
    END $$;

    -- Donations confirmed through the network, recorded once per match
    ALTER TABLE donations ADD COLUMN IF NOT EXISTS network_match_id INTEGER;
    CREATE UNIQUE INDEX IF NOT EXISTS donations_network_match_id_key ON donations (network_match_id);

    -- Last sign-in (admins also keep the IP, for spotting unusual access)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(64);

    -- Hospital details an admin checks before verifying (state also sets jurisdiction)
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS state VARCHAR(60);
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS address VARCHAR(200);
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS pincode VARCHAR(6);
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hospital_type VARCHAR(30);

    -- Admins and their jurisdiction: a national admin sees everything; a city
    -- admin only sees hospitals and donors in their cities
    CREATE TABLE IF NOT EXISTS admin_profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      is_national BOOLEAN NOT NULL DEFAULT FALSE,
      state VARCHAR(60),
      cities TEXT[] NOT NULL DEFAULT '{}',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- One-time admin invites, each issued to one named person (only the hash
    -- of the code is stored)
    CREATE TABLE IF NOT EXISTS admin_invites (
      id SERIAL PRIMARY KEY,
      code_hash CHAR(64) UNIQUE NOT NULL,
      code_hint VARCHAR(4) NOT NULL,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(254) NOT NULL,
      is_national BOOLEAN NOT NULL DEFAULT FALSE,
      state VARCHAR(60),
      cities TEXT[] NOT NULL DEFAULT '{}',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      used_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      revoked_at TIMESTAMPTZ
    );

    -- Admins created before jurisdictions existed become national admins
    -- (runs only while no admin has a profile yet)
    INSERT INTO admin_profiles (user_id, is_national)
      SELECT id, TRUE FROM users
      WHERE role = 'admin' AND NOT EXISTS (SELECT 1 FROM admin_profiles)
      ON CONFLICT (user_id) DO NOTHING;

    -- Supabase exposes the public schema through its REST API with the public
    -- anon key. RLS with no policies closes that door; the backend connects as
    -- the table owner, which bypasses RLS, so the API keeps working.
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE donors ENABLE ROW LEVEL SECURITY;
    ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
    ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE blood_inventory ENABLE ROW LEVEL SECURITY;
    ALTER TABLE blood_requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;

    -- Live location a donor chooses to share with the hospital they are
    -- travelling to, for one accepted request. Kept only while it is useful:
    -- rows go when the donor stops, the donation is recorded or after 3 hours.
    CREATE TABLE IF NOT EXISTS donor_locations (
      match_id INTEGER PRIMARY KEY,
      request_id INTEGER NOT NULL,
      donor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      latitude DECIMAL(9,6) NOT NULL,
      longitude DECIMAL(9,6) NOT NULL,
      accuracy_m INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS donor_locations_request_id ON donor_locations (request_id);
    ALTER TABLE donor_locations ENABLE ROW LEVEL SECURITY;

    -- Which version of this schema was last applied (see below)
    CREATE TABLE IF NOT EXISTS app_schema (
      id INTEGER PRIMARY KEY,
      version VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE app_schema ENABLE ROW LEVEL SECURITY;

    -- Blood donation campaigns (camps) run by admins, their sign-ups and attendance
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(150) NOT NULL,
      description TEXT,
      city VARCHAR(100) NOT NULL,
      state VARCHAR(100),
      venue VARCHAR(200) NOT NULL,
      address TEXT,
      map_url TEXT,
      start_date DATE NOT NULL,
      days INTEGER NOT NULL DEFAULT 1 CHECK (days BETWEEN 1 AND 30),
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      rewards TEXT,
      refreshments TEXT,
      contact_phone VARCHAR(20),
      target_donors INTEGER,
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
      alerted_count INTEGER NOT NULL DEFAULT 0,
      alert_error TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

    CREATE TABLE IF NOT EXISTS campaign_registrations (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      donor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      blood_group VARCHAR(12) NOT NULL,
      gender VARCHAR(20) NOT NULL,
      dob DATE NOT NULL,
      weight_kg INTEGER NOT NULL,
      city VARCHAR(100),
      preferred_date DATE,
      preferred_slot VARCHAR(40),
      last_donation_date DATE,
      health JSONB NOT NULL DEFAULT '{}',
      attended BOOLEAN,
      donated BOOLEAN,
      volume_ml INTEGER,
      remarks VARCHAR(300),
      marked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (campaign_id, phone)
    );
    ALTER TABLE campaign_registrations ENABLE ROW LEVEL SECURITY;

    -- Star reviews: donors rate hospitals and campaigns, hospitals rate donors
    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('hospital', 'donor', 'campaign')),
      target_id INTEGER NOT NULL,
      context VARCHAR(40) NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment VARCHAR(1000),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (reviewer_id, target_type, target_id, context)
    );
    CREATE INDEX IF NOT EXISTS reviews_target ON reviews (target_type, target_id);
    ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

    -- Haversine Distance Function
    CREATE OR REPLACE FUNCTION calculate_distance(lat1 FLOAT, lon1 FLOAT, lat2 FLOAT, lon2 FLOAT)
    RETURNS FLOAT AS $$
    DECLARE
        phi1 FLOAT := lat1 * PI() / 180;
        phi2 FLOAT := lat2 * PI() / 180;
        delta_phi FLOAT := (lat2 - lat1) * PI() / 180;
        delta_lambda FLOAT := (lon2 - lon1) * PI() / 180;
        a FLOAT := SIN(delta_phi / 2) * SIN(delta_phi / 2) + COS(phi1) * COS(phi2) * SIN(delta_lambda / 2) * SIN(delta_lambda / 2);
        c FLOAT := 2 * ATAN2(SQRT(a), SQRT(1 - a));
        r FLOAT := 6371; -- Radius of earth in km
    BEGIN
        RETURN r * c;
    END;
    $$ LANGUAGE plpgsql;
  `;

  // Every serverless cold start calls this. Its ALTER TABLEs lock whole tables,
  // so running them on each start stalled the first requests (the admin
  // dashboard sat on "Loading…"). Now the DDL only runs when the schema text
  // changes, only one instance runs it at a time, and it gives up rather than
  // wait long for a lock (the next cold start tries again).
  const version = createHash('sha256').update(schemaQuery).digest('hex').slice(0, 16);
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Never wait long for a lock, and if this instance is paused mid-way, let
    // Postgres end the transaction instead of keeping tables locked for good
    // (a paused instance once held the users table, so every sign-in hung)
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '15s'");
    await client.query('SAVEPOINT version_check');
    const applied = await client.query('SELECT version FROM app_schema WHERE id = 1').catch(() => null);
    if (!applied) await client.query('ROLLBACK TO SAVEPOINT version_check'); // first run, or the table is busy
    if (applied?.rows[0]?.version === version) {
      await client.query('COMMIT');
      return;
    }

    const { rows } = await client.query('SELECT pg_try_advisory_xact_lock(724724) AS locked');
    if (!rows[0]?.locked) {
      await client.query('ROLLBACK'); // another instance is applying it right now
      return;
    }
    await client.query(schemaQuery);
    await client.query(
      `INSERT INTO app_schema (id, version) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, applied_at = now()`,
      [version]
    );
    await client.query('COMMIT');
    if (process.env.NODE_ENV !== 'production') console.log('[DB] Schema initialized.');
  } catch (err: any) {
    await client?.query('ROLLBACK').catch(() => { });
    console.error('[DB] Initialization failed:', err.message);
  } finally {
    client?.release();
  }
};

export default initDb;
