import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetName: string; // Name of the entity being rated
  targetType: 'donor' | 'hospital';
  onSubmit?: (comment: string) => void;
}

export default function FeedbackModal({ isOpen, onClose, targetName, targetType, onSubmit }: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tags = ["Professional Staff", "Quick Process", "Clean Facility", "Comfortable", "Minimal Pain", "Friendly Nurse"];

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      if (onSubmit) {
        onSubmit(comment.trim() ? comment : "Just completed my donation! The experience was amazing.");
      }
      onClose();
      // Reset state optionally
      setRating(0);
      setComment('');
      setSelectedTags([]);
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-[600px] bg-white rounded-3xl shadow-2xl overflow-hidden relative"
        >
          <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors">
            <span className="material-symbols-outlined text-sm font-bold">close</span>
          </button>

          <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Header Section */}
            <div className="bg-[#fff5f5] pt-12 pb-10 px-8 text-center flex flex-col items-center border-b border-red-50 relative overflow-hidden">
              <div className="w-16 h-16 bg-[#ee2b2b] text-white rounded-full flex items-center justify-center mb-6 shadow-lg shadow-[#ee2b2b]/30 z-10">
                <span className="material-symbols-outlined text-3xl">celebration</span>
              </div>
              <h2 className="text-4xl font-black text-slate-900 mb-3 z-10 tracking-tight">Thank You, Hero!</h2>
              <p className="text-slate-600 font-medium text-base max-w-sm mx-auto z-10">
                Your donation at <span className="font-bold text-[#ee2b2b]">{targetName}</span> has the power to save up to 3 lives.
              </p>

              {/* Decorative dots background pattern */}
              <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ee2b2b 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}></div>
            </div>

            {/* Body Section */}
            <div className="p-10 flex-1 flex flex-col gap-10">
              {/* Rating */}
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900 mb-5">How was your experience today?</h3>
                <div className="flex justify-center gap-3 mb-3">
                  {[1, 2, 3, 4, 5].map((star, index) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => {
                        if (rating === 0) {
                          // Set temporary visual style? Or just logic.
                        }
                      }}
                      onClick={() => setRating(star)}
                      className="transition-transform hover:scale-110 focus:outline-none"
                    >
                      <svg
                        className={`w-12 h-12 transition-colors duration-200 ${rating >= star
                            ? 'text-[#ee2b2b] fill-[#ee2b2b]'
                            : 'text-slate-200 fill-transparent stroke-2'
                          }`}
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={rating >= star ? '0' : '2'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                      </svg>
                    </button>
                  ))}
                </div>
                <p className="text-sm font-semibold text-slate-500">Tap a heart to rate</p>
              </div>

              {/* Tags */}
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 mb-4">What went well?</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all border ${selectedTags.includes(tag)
                        ? "bg-red-50 border-red-200 text-[#ee2b2b] shadow-sm shadow-red-100"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Anything else you'd like to share?</h3>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell us more about your visit..."
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:border-[#ee2b2b] focus:ring-2 focus:ring-[#ee2b2b]/20 outline-none transition-all resize-none text-base placeholder:text-slate-400 bg-slate-50/50"
                />
              </div>

              {/* Impact Banner */}
              <div className="bg-[#fff5f5] rounded-2xl border border-red-100 p-6 shadow-sm">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#ee2b2b] rounded-full flex items-center justify-center text-white shrink-0 shadow-md shadow-red-200">
                      <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">Impact Points Earned</h4>
                      <p className="text-sm font-medium text-slate-500 mt-0.5">You're making a huge difference!</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end pt-1">
                    <span className="text-4xl font-black text-[#ee2b2b] leading-none">+100</span>
                    <span className="text-[10px] font-black text-[#ee2b2b] uppercase tracking-widest mt-1.5">Life Points</span>
                  </div>
                </div>

                <div className="space-y-2 mt-2">
                  <div className="flex justify-between items-center text-xs font-bold px-1">
                    <span className="text-slate-800">Progress to Gold Donor Tier</span>
                    <span className="text-slate-700">850 / 1000 pts</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div className="bg-[#ee2b2b] h-full rounded-full w-[85%]"></div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={rating === 0 || isSubmitting}
                className="w-full py-4 bg-[#ee2b2b] text-white rounded-xl font-bold text-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-lg shadow-red-200 mt-2"
              >
                {isSubmitting ? (
                  <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    Submit Feedback
                    <span className="material-symbols-outlined text-xl font-bold">send</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
