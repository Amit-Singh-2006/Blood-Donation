import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, Building2, X, Phone, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  sender: 'user' | 'other';
  text: string;
  time: string;
}

interface ChatProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  recipientType: 'donor' | 'hospital';
}

export default function Chat({ isOpen, onClose, recipientName, recipientType }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'other', text: `Hello! I see you accepted the request for ${recipientName}.`, time: '10:00 AM' },
  ]);
  const [newMessage, setNewMessage] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([...messages, msg]);
    setNewMessage('');

    // Simulate reply
    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'other',
        text: "Great! Please let us know when you're 5 minutes away.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, reply]);
    }, 2000);
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
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="fixed bottom-4 right-4 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-50 overflow-hidden border border-slate-200 flex flex-col h-[500px]"
          >
            {/* Header */}
            <div className="bg-red-600 p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  {recipientType === 'donor' ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm">{recipientName}</h3>
                  <p className="text-xs text-red-100 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Phone className="w-4 h-4" />
                </button>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[80%]",
                    msg.sender === 'user' ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div
                    className={cn(
                      "px-4 py-2 rounded-2xl text-sm",
                      msg.sender === 'user'
                        ? "bg-red-600 text-white rounded-tr-none"
                        : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                    )}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">
                    {msg.time}
                  </span>
                </div>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
              <button type="button" className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
