import type { ReactNode } from 'react';

export interface Campaign {
  id: number;
  name: string;
  description: string | null;
  city: string;
  state: string | null;
  venue: string;
  address: string | null;
  map_url: string | null;
  days: number;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  rewards: string | null;
  refreshments: string | null;
  contact_phone: string | null;
  target_donors: number | null;
  status: 'active' | 'cancelled';
  registered?: number;
  attended?: number | boolean | null;
  donated?: number | boolean | null;
  volume_ml?: number;
  rating?: number | null;
  reviews?: number;
  alerted_count?: number;
  alert_error?: string | null;
  registration_id?: number | null;
}

export const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

export const isPast = (c: Campaign) => c.end_date < todayIST();

export const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

export const campaignDates = (c: Campaign) =>
  c.days > 1 ? `${fmtDate(c.start_date)} to ${fmtDate(c.end_date)} (${c.days} days)` : fmtDate(c.start_date);

export const campaignHours = (c: Campaign) => `${fmtTime(c.start_time)} to ${fmtTime(c.end_time)}`;

/** Every day the campaign runs, as YYYY-MM-DD. */
export const campaignDays = (c: Campaign) =>
  Array.from({ length: c.days }, (_, i) => {
    const d = new Date(`${c.start_date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });

/** One-hour arrival slots between opening and closing time. */
export const campaignSlots = (c: Campaign) => {
  const start = Number(c.start_time.slice(0, 2));
  const [eh, em] = c.end_time.split(':').map(Number);
  const slots: string[] = [];
  for (let h = start; h < eh + (em > 0 ? 1 : 0); h++) slots.push(`${fmtTime(`${h}:00`)} – ${fmtTime(`${Math.min(h + 1, 23)}:00`)}`);
  return slots;
};

export const CampaignInfo = ({ icon, children }: { icon: string; children: ReactNode }) => (
  <p className="text-sm text-slate-700 flex items-start gap-2">
    <span className="material-symbols-outlined text-lg text-[#ee2b2b] shrink-0">{icon}</span>
    <span className="min-w-0 wrap-break-word">{children}</span>
  </p>
);
