import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, X, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetName: string; // Name of the entity being rated (Donor or Hospital)
  targetType: 'donor' | 'hospital';
}

export default function FeedbackModal({ isOpen, onClose, targetName, targetType }: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setRating(0);
        setComment('');
        onClose();
      }, 2000);
    }, 1000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            {submitted ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ThumbsUp className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Thank You!</h3>
                <p className="text-slate-600 mt-2">Your feedback helps us maintain a high-quality network.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-slate-900">Rate {targetType === 'donor' ? 'Donor' : 'Hospital'}</h3>
                  <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-6 text-center">
                  <p className="text-slate-600 mb-4">How was your experience with <span className="font-semibold text-slate-900">{targetName}</span>?</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={cn(
                          "p-1 transition-colors",
                          rating >= star ? "text-yellow-400" : "text-slate-200 hover:text-yellow-200"
                        )}
                      >
                        <Star className="w-8 h-8 fill-current" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Additional Comments (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share details about your experience..."
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={rating === 0 || isSubmitting}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Submit Feedback
                      <MessageSquare className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
