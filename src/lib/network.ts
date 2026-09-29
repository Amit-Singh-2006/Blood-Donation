import { useEffect, useState } from 'react';

/**
 * Public, read-only endpoints of the LifeLink donor network (n8n). They carry
 * no donor identities: request tracking is keyed by an unguessable token, and
 * analytics are aggregate counts.
 */
export const NETWORK_BASE_URL = import.meta.env.VITE_NETWORK_BASE_URL || 'https://amitsingh7291.app.n8n.cloud/webhook/lifelink';

export interface RequestStatus {
  request_id: number;
  status: 'Open' | 'Fulfilled' | 'Completed' | 'Exhausted' | 'Cancelled';
  hospital_name: string;
  hospital_city: string;
  patient_ref: string | null;
  blood_group: string;
  urgency: string;
  units_required: number;
  units_confirmed: number;
  units_donated: number;
  compatible_donors_found: number;
  donors_alerted: number;
  donors_declined: number;
  donors_no_response: number;
  donors_on_standby: number;
  confirmed_donors: { blood_group: string; distance_miles: number | null; state: string }[];
  next_check_at: string | null;
  next_step: string;
  timeline: { at: string; event: string }[];
}

export interface NetworkAnalytics {
  generated_at: string;
  requests: {
    total: number; open: number; fulfilled: number; completed: number; exhausted: number; cancelled: number;
    covered_pct: number | null; median_minutes_to_first_donor: number | null; first_donor_within_15_min_pct: number | null;
  };
  donor_pool: {
    registered: number; available: number; eligible_now: number; committed_now: number;
    by_blood_group: Record<string, { registered: number; eligible_now: number }>;
  };
  responses: {
    alerts_sent: number; responded: number; response_rate_pct: number | null; accepted: number; acceptance_rate_pct: number | null;
    declined: number; no_response: number; median_response_minutes: number | null; donations_logged: number; no_shows: number;
    alerts_by_channel: Record<string, number>;
  };
  compatibility: { accepted_from_other_compatible_groups: number; share_of_accepted_pct: number | null };
}

const TOKEN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Accepts a bare tracking code or any link that contains one. */
export const extractTrackingToken = (input: string): string | null => {
  const match = input.trim().match(TOKEN);
  return match ? match[0].toLowerCase() : null;
};

/** Returns null when no request matches the token. */
export const fetchRequestStatus = async (token: string): Promise<RequestStatus | null> => {
  const res = await fetch(`${NETWORK_BASE_URL}/request-status?token=${encodeURIComponent(token)}&format=json`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Tracking is unavailable right now (${res.status}).`);
  return res.json();
};

export const fetchNetworkAnalytics = async (): Promise<NetworkAnalytics> => {
  const res = await fetch(`${NETWORK_BASE_URL}/analytics`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Network statistics are unavailable right now (${res.status}).`);
  return res.json();
};

export const useNetworkAnalytics = () => {
  const [data, setData] = useState<NetworkAnalytics | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    fetchNetworkAnalytics()
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, []);
  return { data, error };
};

/** "Under a minute", "12 min", "1 h 5 min"; null-safe. */
export const formatMinutes = (minutes: number | null | undefined): string => {
  if (minutes == null) return '–';
  if (minutes < 1) return 'Under a minute';
  const m = Math.round(minutes);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};
