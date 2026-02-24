import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function FacilityRedeemPage() {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const [redeemed, setRedeemed] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [alreadyUsed, setAlreadyUsed] = useState(false);

    // Decode appointment data passed in URL params
    const name = searchParams.get('name') || 'Health Facility';
    const hospital = searchParams.get('hospital') || 'Partner Hospital';
    const date = searchParams.get('date') || 'N/A';
    const time = searchParams.get('time') || 'N/A';

    useEffect(() => {
        // Check if already redeemed in localStorage
        const usedTickets = JSON.parse(localStorage.getItem('usedTickets') || '[]');
        if (usedTickets.includes(id)) {
            setAlreadyUsed(true);
            setRedeemed(true);
        }
    }, [id]);

    const handleConfirmRedeem = () => {
        setScanning(true);
        setTimeout(() => {
            setScanning(false);
            setRedeemed(true);
            // Mark as used in localStorage
            const usedTickets = JSON.parse(localStorage.getItem('usedTickets') || '[]');
            if (!usedTickets.includes(id)) {
                usedTickets.push(id);
                localStorage.setItem('usedTickets', JSON.stringify(usedTickets));
            }
            // Also persist redemption status so donor dashboard can show it
            const redeemedFacilities = JSON.parse(localStorage.getItem('redeemedFacilities') || '[]');
            redeemedFacilities.push({ id, name, hospital, date, time, redeemedAt: new Date().toISOString() });
            localStorage.setItem('redeemedFacilities', JSON.stringify(redeemedFacilities));
        }, 2000);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
            {/* Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#ee2b2b]/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#ee2b2b]/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md z-10">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 mb-4">
                        <span className="w-2 h-2 bg-[#ee2b2b] rounded-full animate-pulse" />
                        <span className="text-white/80 text-xs font-bold uppercase tracking-widest">LifeBridge Blood Donation</span>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {scanning ? (
                        // Scanning / Processing state
                        <motion.div
                            key="scanning"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/20"
                        >
                            <div className="relative w-24 h-24 mx-auto mb-6">
                                <div className="absolute inset-0 rounded-full border-4 border-white/20" />
                                <div className="absolute inset-0 rounded-full border-4 border-t-[#ee2b2b] animate-spin" />
                                <div className="absolute inset-3 rounded-full bg-white/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-3xl">qr_code_scanner</span>
                                </div>
                            </div>
                            <h2 className="text-white font-black text-xl mb-2">Verifying Ticket...</h2>
                            <p className="text-white/60 text-sm">Please wait while we confirm the redemption.</p>
                        </motion.div>
                    ) : redeemed ? (
                        // Redeemed / Success state
                        <motion.div
                            key="redeemed"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">
                                {/* Success header */}
                                <div className={`p-8 text-center ${alreadyUsed ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', delay: 0.2, stiffness: 200 }}
                                        className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
                                    >
                                        <span className="material-symbols-outlined text-white text-5xl">
                                            {alreadyUsed ? 'warning' : 'verified'}
                                        </span>
                                    </motion.div>
                                    <h1 className="text-white text-2xl font-black tracking-tight">
                                        {alreadyUsed ? 'Already Redeemed' : 'Facility Redeemed! ✓'}
                                    </h1>
                                    <p className="text-white/80 text-sm mt-1">
                                        {alreadyUsed
                                            ? 'This ticket has already been used.'
                                            : 'Redemption confirmed successfully.'
                                        }
                                    </p>
                                </div>

                                {/* Ticket details */}
                                <div className="p-6 space-y-4">
                                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="w-10 h-10 bg-[#ee2b2b]/10 text-[#ee2b2b] rounded-xl flex items-center justify-center">
                                            <span className="material-symbols-outlined text-xl">confirmation_number</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket ID</p>
                                            <p className="font-black text-[#ee2b2b] tracking-wider">{id}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Service</p>
                                            <p className="font-bold text-slate-900 text-sm leading-tight">{name}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hospital</p>
                                            <p className="font-bold text-slate-900 text-sm leading-tight">{hospital}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</p>
                                            <p className="font-bold text-slate-900 text-sm">{date}</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Time</p>
                                            <p className="font-bold text-slate-900 text-sm">{time}</p>
                                        </div>
                                    </div>

                                    {!alreadyUsed && (
                                        <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                            <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                                            <p className="text-sm font-bold text-emerald-700">
                                                Redeemed on {new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className="text-center text-white/40 text-xs">
                                Powered by LifeBridge · AI Blood Donation Platform
                            </p>
                        </motion.div>
                    ) : (
                        // Pre-redemption / Scan landing state
                        <motion.div
                            key="confirm"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">
                                {/* Ticket header */}
                                <div className="bg-[#ee2b2b] p-6 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-12 -mt-12 pointer-events-none" />
                                    <div className="relative z-10">
                                        <span className="bg-white/20 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded">
                                            🎟️ Redemption Ticket
                                        </span>
                                        <h2 className="text-2xl font-black mt-2">{name}</h2>
                                        <p className="text-white/80 text-sm">{hospital} · {date} · {time}</p>
                                    </div>
                                </div>

                                <div className="p-6 space-y-4">
                                    {/* Ticket ID */}
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ticket ID</p>
                                            <p className="font-black text-[#ee2b2b] tracking-wider text-lg">{id}</p>
                                        </div>
                                        <div className="w-12 h-12 bg-[#ee2b2b]/10 rounded-xl flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[#ee2b2b] text-2xl">confirmation_number</span>
                                        </div>
                                    </div>

                                    {/* Instructions */}
                                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                        <span className="material-symbols-outlined text-blue-500 mt-0.5">info</span>
                                        <p className="text-sm text-blue-700 font-medium">
                                            This ticket was scanned by hospital staff. Click <strong>Confirm Redemption</strong> to mark this facility as used.
                                        </p>
                                    </div>

                                    {/* Confirm button */}
                                    <button
                                        onClick={handleConfirmRedeem}
                                        className="w-full py-4 bg-[#ee2b2b] hover:bg-[#ee2b2b]/90 text-white font-black text-lg rounded-2xl shadow-lg shadow-[#ee2b2b]/30 transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined">check_circle</span>
                                        Confirm Redemption
                                    </button>
                                </div>
                            </div>

                            <p className="text-center text-white/40 text-xs">
                                Powered by LifeBridge · AI Blood Donation Platform
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Google Material Symbols */}
            <link
                rel="stylesheet"
                href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
            />
        </div>
    );
}
