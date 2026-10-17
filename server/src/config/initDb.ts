import { createHash } from 'crypto';
import pool from './db';

/** Applies the schema if it changed; true once the database is up to date. */
const initDb = async (): Promise<boolean> => {
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

    -- Link each request to the donor network (tokens stay server-side)
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

    -- Verification with documents: the hospital uploads its registration
    -- certificate and a signed authorisation letter, then an admin checks them
    -- and phones the hospital before approving. Hospitals verified before
    -- documents were asked for keep their status (their verified_at is empty).
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'not_submitted'
      CHECK (verification_status IN ('not_submitted', 'pending', 'changes_requested', 'verified'));
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS registration_authority VARCHAR(120);
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hfr_id VARCHAR(20);
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS blood_centre_licence VARCHAR(60);
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS authorised_person VARCHAR(100);
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS authorised_designation VARCHAR(80);
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ;
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS verification_note VARCHAR(500);
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
    ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
    UPDATE hospitals SET verification_status = 'verified' WHERE is_verified AND verification_status = 'not_submitted';

    -- One file per kind, replaced on re-upload. Kept in the database (small,
    -- checked files) so they are private to this API like every other table.
    CREATE TABLE IF NOT EXISTS hospital_documents (
      hospital_id INTEGER NOT NULL REFERENCES hospitals(user_id) ON DELETE CASCADE,
      kind VARCHAR(30) NOT NULL CHECK (kind IN ('registration_certificate', 'authorisation_letter', 'blood_centre_licence')),
      content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
      size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 3145728),
      sha256 CHAR(64) NOT NULL,
      data BYTEA NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (hospital_id, kind)
    );
    ALTER TABLE hospital_documents ENABLE ROW LEVEL SECURITY;

    -- Who did what to a hospital's verification, and when
    CREATE TABLE IF NOT EXISTS hospital_verification_log (
      id SERIAL PRIMARY KEY,
      hospital_id INTEGER NOT NULL REFERENCES hospitals(user_id) ON DELETE CASCADE,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(20) NOT NULL CHECK (action IN ('uploaded', 'removed', 'submitted', 'viewed', 'approved', 'changes_requested', 'revoked')),
      detail VARCHAR(500),
      checks JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS hospital_verification_log_hospital ON hospital_verification_log (hospital_id, created_at DESC);
    ALTER TABLE hospital_verification_log ENABLE ROW LEVEL SECURITY;
    -- Admins opening a document is logged too: approval needs it
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hospital_verification_log_action_check'
                 AND pg_get_constraintdef(oid) NOT LIKE '%viewed%') THEN
        ALTER TABLE hospital_verification_log DROP CONSTRAINT hospital_verification_log_action_check;
        ALTER TABLE hospital_verification_log ADD CONSTRAINT hospital_verification_log_action_check
          CHECK (action IN ('uploaded', 'removed', 'submitted', 'viewed', 'approved', 'changes_requested', 'revoked'));
      END IF;
    END $$;

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

    -- Two-step verification (authenticator app) for admin and hospital accounts.
    -- The secret is encrypted; backup codes are kept only as hashes.
    CREATE TABLE IF NOT EXISTS user_mfa (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      secret_enc TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT FALSE,
      last_step BIGINT,
      backup_hashes JSONB NOT NULL DEFAULT '[]',
      enabled_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE user_mfa ENABLE ROW LEVEL SECURITY;

    -- "Keep me signed in": long-lived sign-ins that renew the 30-minute session
    -- cookie (utils/keepSignedIn). Only a hash of each token is stored.
    CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      persistent BOOLEAN NOT NULL DEFAULT TRUE,
      user_agent VARCHAR(300),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS user_sessions_user ON user_sessions (user_id);
    ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

    -- Forgot password: emailed codes (only a keyed hash is stored) and how far each reset got
    CREATE TABLE IF NOT EXISTS password_resets (
      id UUID PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash CHAR(64) NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      verified_at TIMESTAMPTZ,
      second_step_at TIMESTAMPTZ,
      used_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS password_resets_user ON password_resets (user_id, created_at);
    ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

    -- The donor network (src/network), which ran in n8n until October 2026: the
    -- donor registry (keyed by phone, so USSD donors without a website account
    -- fit too), requests, each donor ranked for each request, a log of what
    -- everyone was told, and the queue of SMS, WhatsApp and email to send.
    CREATE TABLE IF NOT EXISTS network_donors (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL UNIQUE,
      blood_group VARCHAR(3) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
      gender VARCHAR(12) NOT NULL DEFAULT 'unspecified',
      city VARCHAR(100) NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      available BOOLEAN NOT NULL DEFAULT TRUE,
      last_donation_date DATE,
      total_donations INTEGER NOT NULL DEFAULT 0,
      preferred_channel VARCHAR(10) NOT NULL DEFAULT 'sms',
      fcm_token TEXT,
      xp_points INTEGER NOT NULL DEFAULT 0,
      committed_until TIMESTAMPTZ,
      source VARCHAR(10) NOT NULL DEFAULT 'web',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE network_donors ENABLE ROW LEVEL SECURITY;
    -- The website account a registry entry belongs to (USSD donors have none).
    -- Phones are not verified, so without this anyone signing up with someone
    -- else's number saw that donor's alerts and could answer them.
    ALTER TABLE network_donors ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
    CREATE UNIQUE INDEX IF NOT EXISTS network_donors_user_id ON network_donors (user_id);

    CREATE TABLE IF NOT EXISTS network_requests (
      id SERIAL PRIMARY KEY,
      hospital_name VARCHAR(200) NOT NULL,
      hospital_city VARCHAR(100) NOT NULL,
      hospital_contact VARCHAR(20),
      patient_ref VARCHAR(40),
      blood_group VARCHAR(3) NOT NULL,
      units_required INTEGER NOT NULL CHECK (units_required BETWEEN 1 AND 20),
      urgency VARCHAR(10) NOT NULL CHECK (urgency IN ('Normal', 'Urgent', 'Emergency')),
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      required_by TIMESTAMPTZ,
      status VARCHAR(10) NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Fulfilled', 'Completed', 'Exhausted', 'Cancelled')),
      units_confirmed INTEGER NOT NULL DEFAULT 0,
      units_donated INTEGER NOT NULL DEFAULT 0,
      compatible_donors INTEGER NOT NULL DEFAULT 0,
      donors_notified INTEGER NOT NULL DEFAULT 0,
      wave_size INTEGER NOT NULL,
      escalation_minutes INTEGER NOT NULL,
      escalation_rounds INTEGER NOT NULL DEFAULT 0,
      status_token VARCHAR(36) NOT NULL UNIQUE,
      hospital_token VARCHAR(36) NOT NULL,
      first_accept_at TIMESTAMPTZ,
      fulfilled_at TIMESTAMPTZ,
      closed_reason VARCHAR(40),
      closed_at TIMESTAMPTZ,
      -- When escalation next looks at the request; NULL once it has stopped
      next_check_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS network_requests_due ON network_requests (next_check_at) WHERE next_check_at IS NOT NULL;
    ALTER TABLE network_requests ENABLE ROW LEVEL SECURITY;

    CREATE TABLE IF NOT EXISTS network_matches (
      id SERIAL PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES network_requests(id) ON DELETE CASCADE,
      donor_id INTEGER REFERENCES network_donors(id) ON DELETE SET NULL,
      donor_blood_group VARCHAR(3) NOT NULL,
      request_blood_group VARCHAR(3) NOT NULL,
      rank INTEGER NOT NULL,
      distance_km DOUBLE PRECISION,
      exact_match BOOLEAN NOT NULL DEFAULT FALSE,
      status VARCHAR(12) NOT NULL,
      response_token VARCHAR(36) NOT NULL,
      channel VARCHAR(10) NOT NULL DEFAULT 'in_app',
      contact TEXT,
      hospital_name VARCHAR(200) NOT NULL,
      hospital_city VARCHAR(100) NOT NULL,
      urgency VARCHAR(10) NOT NULL,
      units_required INTEGER NOT NULL,
      notified_at TIMESTAMPTZ,
      responded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS network_matches_request ON network_matches (request_id);
    CREATE INDEX IF NOT EXISTS network_matches_donor ON network_matches (donor_id);
    ALTER TABLE network_matches ENABLE ROW LEVEL SECURITY;

    -- The blood group a hospital's lab found after a donation. The latest lab
    -- result becomes the donor's group and marks it lab-confirmed; from then on
    -- the donor's own profile can no longer change it.
    ALTER TABLE network_donors ADD COLUMN IF NOT EXISTS blood_group_verified_at TIMESTAMPTZ;
    ALTER TABLE network_matches ADD COLUMN IF NOT EXISTS lab_blood_group VARCHAR(3)
      CHECK (lab_blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));
    ALTER TABLE network_matches ADD COLUMN IF NOT EXISTS lab_recorded_at TIMESTAMPTZ;
    ALTER TABLE network_matches ADD COLUMN IF NOT EXISTS lab_recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

    -- Request and match ids carry on above the n8n ones, which blood_requests,
    -- donations and donor_locations still hold for older requests
    SELECT setval(pg_get_serial_sequence('network_requests', 'id'), GREATEST(1000, (SELECT last_value FROM network_requests_id_seq)));
    SELECT setval(pg_get_serial_sequence('network_matches', 'id'), GREATEST(10000, (SELECT last_value FROM network_matches_id_seq)));

    CREATE TABLE IF NOT EXISTS network_notifications (
      id SERIAL PRIMARY KEY,
      donor_id INTEGER,
      request_id INTEGER,
      match_id INTEGER,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(40) NOT NULL,
      channel VARCHAR(10) NOT NULL DEFAULT 'in_app',
      recipient VARCHAR(255) NOT NULL,
      accept_url TEXT,
      decline_url TEXT,
      confirm_donation_url TEXT,
      no_show_url TEXT,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS network_notifications_request ON network_notifications (request_id);
    ALTER TABLE network_notifications ENABLE ROW LEVEL SECURITY;

    CREATE TABLE IF NOT EXISTS network_outbox (
      id SERIAL PRIMARY KEY,
      channel VARCHAR(10) NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email')),
      recipient VARCHAR(320) NOT NULL,
      payload JSONB NOT NULL,
      purpose VARCHAR(20) NOT NULL,
      ref_id INTEGER,
      status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      provider_id VARCHAR(120),
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      sent_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS network_outbox_due ON network_outbox (next_attempt_at) WHERE status = 'pending';
    ALTER TABLE network_outbox ENABLE ROW LEVEL SECURITY;

    -- Website donors join the registry (the n8n registry went with the n8n
    -- instance). Phones are normalised like toE164 in services/donorNetwork.
    INSERT INTO network_donors (name, phone, blood_group, gender, city, available, last_donation_date, total_donations, preferred_channel, xp_points, source)
    SELECT DISTINCT ON (p.phone)
           left(trim(u.name), 100), p.phone, d.blood_group,
           CASE WHEN lower(d.gender) IN ('male', 'female', 'other') THEN lower(d.gender) ELSE 'unspecified' END,
           left(trim(d.city), 100), TRUE, d.last_donation_date,
           (SELECT count(*) FROM donations x WHERE x.donor_id = u.id)::int, 'sms', COALESCE(d.xp_points, 0), 'web'
    FROM users u
    JOIN donors d ON d.user_id = u.id
    CROSS JOIN LATERAL (SELECT regexp_replace(COALESCE(d.phone, ''), '[\\s()-]', '', 'g') AS raw) r
    CROSS JOIN LATERAL (SELECT CASE WHEN r.raw ~ '^\\+\\d{10,15}$' THEN r.raw
                                    WHEN r.raw ~ '^0?\\d{10}$' THEN '+91' || right(r.raw, 10)
                                    WHEN r.raw ~ '^91\\d{10}$' THEN '+' || r.raw END AS phone) p
    WHERE u.role = 'donor' AND p.phone IS NOT NULL AND d.blood_group IS NOT NULL
      AND length(trim(COALESCE(d.city, ''))) >= 2 AND length(trim(u.name)) >= 2
    ORDER BY p.phone, u.id DESC
    ON CONFLICT (phone) DO NOTHING;

    -- Imported entries belong to the website account with that phone (the newest, as above)
    UPDATE network_donors n SET user_id = s.user_id
    FROM (
      SELECT DISTINCT ON (p.phone) p.phone, u.id AS user_id
      FROM users u
      JOIN donors d ON d.user_id = u.id
      CROSS JOIN LATERAL (SELECT regexp_replace(COALESCE(d.phone, ''), '[\\s()-]', '', 'g') AS raw) r
      CROSS JOIN LATERAL (SELECT CASE WHEN r.raw ~ '^\\+\\d{10,15}$' THEN r.raw
                                      WHEN r.raw ~ '^0?\\d{10}$' THEN '+91' || right(r.raw, 10)
                                      WHEN r.raw ~ '^91\\d{10}$' THEN '+' || r.raw END AS phone) p
      WHERE u.role = 'donor' AND p.phone IS NOT NULL
      ORDER BY p.phone, u.id DESC
    ) s
    WHERE n.phone = s.phone AND n.user_id IS NULL AND n.source = 'web'
      AND NOT EXISTS (SELECT 1 FROM network_donors x WHERE x.user_id = s.user_id);

    -- pg_net belongs in the extensions schema, not in public (Supabase's advice)
    DO $netschema$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
                 WHERE e.extname = 'pg_net' AND n.nspname = 'public') THEN
        DROP EXTENSION pg_net;
        CREATE EXTENSION pg_net WITH SCHEMA extensions;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_net not moved: %', SQLERRM;
    END
    $netschema$;

    -- The one-minute timer that drives escalation and message retries
    -- (Supabase pg_cron + pg_net). It calls the API only when something is
    -- due. Elsewhere these extensions may be missing; the timer is then
    -- skipped and escalation runs whenever a hospital or family checks a request.
    DO $timer$
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
      PERFORM cron.schedule('lifelink-network-tick', '* * * * *', $job$
        SELECT net.http_post(
          url := 'https://blood-donation-backend-sepia.vercel.app/network/tick',
          body := '{}'::jsonb,
          headers := '{"Content-Type": "application/json"}'::jsonb,
          timeout_milliseconds := 30000)
        WHERE EXISTS (SELECT 1 FROM public.network_requests WHERE next_check_at <= now())
           OR EXISTS (SELECT 1 FROM public.network_outbox WHERE status = 'pending' AND next_attempt_at <= now())
      $job$);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'LifeLink network timer not set up: %', SQLERRM;
    END
    $timer$;

    -- pg_cron logs every run; keep a week of it
    DO $cleanup$
    BEGIN
      PERFORM cron.schedule('lifelink-cron-cleanup', '17 3 * * *',
        $job$ DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days' $job$);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'LifeLink cron cleanup not set up: %', SQLERRM;
    END
    $cleanup$;

    -- The old SQL distance helper: the network now measures distances itself
    DROP FUNCTION IF EXISTS calculate_distance(FLOAT, FLOAT, FLOAT, FLOAT);

    -- Only this API (the tables' owner) reads these tables. Supabase's public
    -- REST and GraphQL APIs already see nothing (RLS with no policies); taking
    -- away their table rights too keeps a table closed even if RLS is ever
    -- switched off by mistake. Off Supabase those roles do not exist.
    DO $grants$
    BEGIN
      REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
      REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
      -- Supabase's own "turn on RLS for new tables" trigger function needs no public callers
      IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
        REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
      END IF;
    EXCEPTION WHEN undefined_object THEN
      NULL;
    END
    $grants$;
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
      return true;
    }

    const { rows } = await client.query('SELECT pg_try_advisory_xact_lock(724724) AS locked');
    if (!rows[0]?.locked) {
      await client.query('ROLLBACK'); // another instance is applying it right now
      return false;
    }
    await client.query(schemaQuery);
    await client.query(
      `INSERT INTO app_schema (id, version) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, applied_at = now()`,
      [version]
    );
    await client.query('COMMIT');
    if (process.env.NODE_ENV !== 'production') console.log('[DB] Schema initialized.');
    return true;
  } catch (err: any) {
    await client?.query('ROLLBACK').catch(() => { });
    console.error('[DB] Initialization failed:', err.message);
    return false;
  } finally {
    client?.release();
  }
};

export default initDb;
