import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: '1', sender: 'bot', text: 'Hi! I\'m LifeLink Assistant. Ask me about eligibility, donation process, or finding a center.' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg = { id: Date.now().toString(), sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      let responseText = "I'm not sure about that. Can you try asking differently?";
      const lowerInput = input.toLowerCase();
      
      if (lowerInput.includes('tattoo')) {
        responseText = "Generally, you need to wait 6-12 months after getting a tattoo to donate blood, depending on local regulations and if it was done at a licensed facility.";
      } else if (lowerInput.includes('alcohol') || lowerInput.includes('drink')) {
        responseText = "You should avoid alcohol for 24 hours before donating. Hydrate well with water instead!";
      } else if (lowerInput.includes('weight') || lowerInput.includes('heavy')) {
        responseText = "Donors typically need to weigh at least 50kg (110lbs) to donate whole blood safely.";
      } else if (lowerInput.includes('pain') || lowerInput.includes('hurt')) {
        responseText = "You might feel a small pinch, but the donation process is generally painless. Saving a life feels great though!";
      }

      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'bot', text: responseText }]);
    }, 1000);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform z-50"
      >
        <Bot className="w-5 h-5" />
        <span className="text-sm font-bold">AI Assistant</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 right-6 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col max-h-[500px]"
          >
            <div className="bg-red-600 p-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                <span className="font-bold">Assistant</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 h-[300px]">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                      msg.sender === 'user'
                        ? 'bg-red-600 text-white rounded-tr-none'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 bg-slate-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
