import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import { fmtDate } from '../lib/campaign';

interface Item {
  target_type: 'hospital' | 'donor' | 'campaign';
  target_id: number;
  context: string;
  title: string;
  subtitle: string;
  date: string;
  my_review: { rating: number; comment: string | null } | null;
}
interface Received { rating: number; comment: string | null; date: string; from_name: string }

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5" role={onChange ? 'radiogroup' : 'img'} aria-label={onChange ? 'Your rating' : `${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const star = (
          <span className={`material-symbols-outlined text-2xl ${n <= value ? 'text-amber-400' : 'text-slate-300'}`} style={{ fontVariationSettings: `'FILL' ${n <= value ? 1 : 0}` }}>star</span>
        );
        return onChange
          ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)}>{star}</button>
          : <span key={n}>{star}</span>;
      })}
    </div>
  );
}

const ICON = { hospital: 'local_hospital', campaign: 'campaign', donor: 'volunteer_activism' } as const;

function ReviewCard({ item, onSaved }: { item: Item; onSaved: () => void }) {
  const [rating, setRating] = useState(item.my_review?.rating ?? 0);
  const [comment, setComment] = useState(item.my_review?.comment ?? '');
  const [state, setState] = useState('');

  const save = async () => {
    if (!rating) { setState('Choose 1 to 5 stars'); return; }
    setState('Saving…');
    try {
      await apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({ target_type: item.target_type, target_id: item.target_id, context: item.context, rating, comment: comment.trim() || undefined }),
      });
      setState('Saved. Thank you!');
      onSaved();
    } catch (e: any) {
      setState(e.message);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-[#ee2b2b] bg-red-50 rounded-xl p-2">{ICON[item.target_type]}</span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-slate-900 wrap-break-word">{item.title}</p>
          <p className="text-xs text-slate-500">{item.subtitle} · {fmtDate(item.date)}</p>
        </div>
        {item.my_review && <span className="text-[10px] font-black uppercase text-green-700 bg-green-50 px-2 py-1 rounded-md shrink-0">Reviewed</span>}
      </div>
      <Stars value={rating} onChange={setRating} />
      <textarea rows={2} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Your review"
        placeholder="What went well, and what could be better? (optional)"
        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#ee2b2b] focus:ring-2 focus:ring-red-100" />
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} className="px-4 py-2 rounded-xl bg-[#ee2b2b] text-white text-xs font-black hover:bg-red-700">{item.my_review ? 'Update review' : 'Submit review'}</button>
        {state && <span className="text-xs font-bold text-slate-500">{state}</span>}
      </div>
    </div>
  );
}

function ReviewsPanel({ intro, empty, receivedTitle, receivedEmpty }: { intro: string; empty: string; receivedTitle: string; receivedEmpty: string }) {
  const [data, setData] = useState<{ to_review: Item[]; received: Received[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    apiFetch('/reviews/mine').then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  if (error) return <p className="text-sm font-bold text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading reviews…</p>;

  const count = data.received.length;
  const avg = count ? data.received.reduce((sum, r) => sum + r.rating, 0) / count : 0;
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
          <h2 className="text-lg font-black text-slate-900">Reviews</h2>
          <p className="text-sm text-slate-600">{intro}</p>
        </div>
        {data.to_review.length === 0
          ? <p className="text-sm text-slate-500">{empty}</p>
          : <div className="grid gap-4 md:grid-cols-2">{data.to_review.map((it) => <ReviewCard key={`${it.target_type}-${it.context}`} item={it} onSaved={load} />)}</div>}
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">{receivedTitle}</h3>
          {count > 0 && <span className="flex items-center gap-2 text-sm font-black text-slate-700"><Stars value={Math.round(avg)} />{avg.toFixed(1)} from {count} review{count === 1 ? '' : 's'}</span>}
        </div>
        {count === 0 ? <p className="text-sm text-slate-500">{receivedEmpty}</p> : data.received.map((r, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-slate-900">{r.from_name}</p>
              <Stars value={r.rating} />
            </div>
            {r.comment && <p className="text-sm text-slate-600 mt-1 wrap-break-word">{r.comment}</p>}
            <p className="text-xs text-slate-400 mt-1">{fmtDate(r.date)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

export const DonorReviews = () => (
  <ReviewsPanel
    intro="Rate the hospitals where you donated and the campaigns you joined. Your feedback helps them look after donors better."
    empty="Once you donate at a hospital or join a campaign, you can review it here."
    receivedTitle="What hospitals say about you"
    receivedEmpty="No hospital has reviewed you yet."
  />
);

export const HospitalReviews = () => (
  <ReviewsPanel
    intro="Rate the donors who donated at your hospital: punctuality, communication and how the donation went."
    empty="Donors who donate at your hospital appear here for review."
    receivedTitle="What donors say about your hospital"
    receivedEmpty="No donor has reviewed your hospital yet."
  />
);
