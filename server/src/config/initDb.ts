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
      status VARCHAR(20) DEFAULT 'Open' CHECK (status IN ('Open', 'Fulfilled', 'Cancelled')),
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
        r FLOAT := 3959; -- Radius of earth in miles
    BEGIN
        RETURN r * c;
    END;
    $$ LANGUAGE plpgsql;
  `;

  try {
    const client = await pool.connect();
    console.log('Successfully connected to the database for initialization.');
    await client.query(schemaQuery);
    console.log('Database tables verified/upgraded successfully.');
    client.release();
  } catch (err: any) {
    console.error('Failed to connect to the database or upgrade tables:', err.message);
  }
};

export default initDb;
