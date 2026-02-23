import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { cn } from '@/lib/utils';
import { apiFetch } from '../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type PageContext = 'hospital' | 'donor' | 'admin';

interface AgentChatProps {
    isOpen: boolean;
    onClose: () => void;
    context: PageContext;
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'tool_status';
    text: string;
    time: string;
    isAction?: boolean;
    actionSuccess?: boolean;
}

// ─── Tool Definitions (Gemini Function Declarations) ─────────────────────────

const HOSPITAL_TOOLS = [
    {
        name: 'get_inventory',
        description: 'Get the current blood inventory for this hospital. Returns units of each blood type.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'create_emergency_request',
        description: 'Create an emergency blood request for this hospital. Use when the user asks to raise, create, or broadcast a blood request.',
        parameters: {
            type: 'object',
            properties: {
                blood_group: {
                    type: 'string',
                    description: 'Blood group required. Must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-',
                    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
                },
                units_required: {
                    type: 'number',
                    description: 'Number of blood units required',
                },
                urgency: {
                    type: 'string',
                    description: 'Urgency level of the request',
                    enum: ['standard', 'critical'],
                },
            },
            required: ['blood_group', 'units_required', 'urgency'],
        },
    },
    {
        name: 'get_requests',
        description: 'Get all blood requests made by this hospital.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_donations',
        description: 'Get recent donations received by this hospital.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
];

const DONOR_TOOLS = [
    {
        name: 'get_donor_profile',
        description: 'Get the current donor profile including blood group, XP points, and eligibility.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_nearby_requests',
        description: 'Find active blood requests near the donor.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
];

const ADMIN_TOOLS = [
    {
        name: 'get_all_hospitals',
        description: 'Get a list of all registered hospitals.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'get_all_donors',
        description: 'Get a list of all registered donors.',
        parameters: { type: 'object', properties: {}, required: [] },
    },
];

// ─── Tool Executor ─────────────────────────────────────────────────────────────

async function executeTool(name: string, args: any): Promise<string> {
    try {
        switch (name) {
            case 'get_inventory': {
                const data = await apiFetch('/hospital/inventory');
                if (!data || data.length === 0) return 'No inventory data found. The blood bank may have no entries yet.';
                const lines = data.map((i: any) => `• ${i.blood_group}: ${i.units} units`).join('\n');
                return `Current blood inventory:\n${lines}`;
            }

            case 'create_emergency_request': {
                const result = await apiFetch('/hospital/requests', {
                    method: 'POST',
                    body: JSON.stringify({
                        blood_group: args.blood_group,
                        units_required: args.units_required,
                        urgency: args.urgency,
                    }),
                });
                return `✅ Emergency request created successfully!\nRequest ID: #${result.id}\nBlood Group: ${result.blood_group}\nUnits: ${result.units_required}\nUrgency: ${result.urgency}\nNearby donors are being notified.`;
            }

            case 'get_requests': {
                const data = await apiFetch('/hospital/requests');
                if (!data || data.length === 0) return 'No blood requests found for this hospital yet.';
                const lines = data.slice(0, 5).map((r: any) =>
                    `• Request #${r.id} — ${r.blood_group}, ${r.units_required} units, ${r.urgency} (${r.status || 'pending'})`
                ).join('\n');
                return `Your recent blood requests:\n${lines}${data.length > 5 ? `\n...and ${data.length - 5} more.` : ''}`;
            }

            case 'get_donations': {
                const data = await apiFetch('/hospital/donations');
                if (!data || data.length === 0) return 'No donations recorded for this hospital yet.';
                const lines = data.slice(0, 5).map((d: any) =>
                    `• ${d.donor_name} — ${d.units} units on ${new Date(d.donation_date).toLocaleDateString()}`
                ).join('\n');
                return `Recent donations:\n${lines}`;
            }

            case 'get_donor_profile': {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                return `Donor profile:\nName: ${user.name || 'Unknown'}\nEmail: ${user.email || 'Unknown'}\nRole: Donor`;
            }

            case 'get_nearby_requests': {
                return 'Nearby blood requests feature coming soon. Check your dashboard for current requests.';
            }

            case 'get_all_hospitals': {
                try {
                    const data = await apiFetch('/admin/hospitals');
                    if (!data || data.length === 0) return 'No hospitals registered yet.';
                    const lines = data.slice(0, 5).map((h: any) => `• ${h.name} — ${h.city || 'N/A'}`).join('\n');
                    return `Registered hospitals:\n${lines}`;
                } catch {
                    return 'Unable to fetch hospital data. Admin access required.';
                }
            }

            case 'get_all_donors': {
                try {
                    const data = await apiFetch('/admin/donors');
                    if (!data || data.length === 0) return 'No donors registered yet.';
                    return `Total registered donors: ${data.length}`;
                } catch {
                    return 'Unable to fetch donor data. Admin access required.';
                }
            }

            default:
                return `Unknown tool: ${name}`;
        }
    } catch (err: any) {
        return `Error executing action: ${err.message || 'Unknown error'}`;
    }
}

// ─── System Prompts ──────────────────────────────────────────────────────────

function getSystemPrompt(context: PageContext): string {
    const base = `You are LifeLink AI, an intelligent agentic assistant for the LifeLink AI Blood Donation platform.
You are embedded inside the app and can take REAL ACTIONS like checking inventory, raising emergency blood requests, and viewing data.
Always be concise, professional, and caring. Use emojis sparingly but effectively.
When a user asks you to perform an action (e.g. "raise an emergency request", "check inventory"), ALWAYS call the appropriate tool — don't just describe how to do it.
After a tool call, summarize the result clearly for the user.`;

    const contexts: Record<PageContext, string> = {
        hospital: `${base}

CURRENT CONTEXT: Hospital Dashboard
You are assisting hospital staff. You have access to:
- Blood inventory data (get_inventory) 
- Emergency blood requests (get_requests, create_emergency_request)
- Donation history (get_donations)

EXAMPLES:
- "How many O+ units do we have?" → call get_inventory
- "Raise an emergency for B- blood, 2 units" → call create_emergency_request
- "Show our pending requests" → call get_requests`,

        donor: `${base}

CURRENT CONTEXT: Donor Dashboard
You are assisting a blood donor. You have access to:
- Their profile (get_donor_profile)
- Nearby blood requests (get_nearby_requests)

Help them understand their donation history, eligibility, and how they can help save lives.`,

        admin: `${base}

CURRENT CONTEXT: Admin Dashboard
You are assisting an administrator. You can:
- View all hospitals (get_all_hospitals)
- View all donors (get_all_donors)

Help monitor the platform, view statistics, and manage users.`,
    };

    return contexts[context];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentChat({ isOpen, onClose, context }: AgentChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const tools = context === 'hospital' ? HOSPITAL_TOOLS : context === 'donor' ? DONOR_TOOLS : ADMIN_TOOLS;

    const contextLabels: Record<PageContext, string> = {
        hospital: 'Hospital AI',
        donor: 'Donor AI',
        admin: 'Admin AI',
    };

    const suggestedPrompts: Record<PageContext, string[]> = {
        hospital: [
            'How many A+ units do we have?',
            'Raise emergency for O- blood, 2 units, critical',
            'Show our recent requests',
            'What donations have we received?',
        ],
        donor: [
            'Show my donor profile',
            'Am I eligible to donate?',
            'Find nearby blood requests',
        ],
        admin: [
            'List all hospitals',
            'How many donors are registered?',
        ],
    };

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([{
                id: '0',
                role: 'assistant',
                text: `👋 Hi! I'm **LifeLink AI** — your ${contextLabels[context]} assistant.\n\nI can take real actions: check inventory, raise emergency requests, view data, and more. Just ask me anything!`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
        }
    }, [isOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isThinking]);

    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
    }, [isOpen]);

    const addMessage = (msg: Omit<Message, 'id' | 'time'>) => {
        setMessages(prev => [...prev, {
            ...msg,
            id: Date.now().toString() + Math.random(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);
    };

    const handleSend = async (text?: string) => {
        const userText = (text || input).trim();
        if (!userText || isThinking) return;
        setInput('');

        addMessage({ role: 'user', text: userText });
        setIsThinking(true);

        try {
            const apiKey = import.meta.env.VITE_GROQ_API_KEY;
            if (!apiKey) throw new Error('Groq API key not configured.');

            const MODEL = 'llama-3.3-70b-versatile';
            const BASE = 'https://api.groq.com/openai/v1/chat/completions';

            // IMPORTANT: setMessages is async, so we use the functional update to get the latest messages
            // But since we are in handleSend, we can just build the history from current state
            const priorMessages = messages
                .filter(m => m.role === 'user' || m.role === 'assistant')
                .map(m => ({
                    role: m.role,
                    content: m.text || '',
                }));

            const groqTools = tools.map((t: any) => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters || { type: 'object', properties: {} },
                },
            }));

            let apiMessages: any[] = [
                { role: 'system', content: getSystemPrompt(context) },
                ...priorMessages,
                { role: 'user', content: userText },
            ];

            let iteration = 0;
            const MAX_ITERATIONS = 5;
            let hasAddedAssistantReply = false;

            while (iteration < MAX_ITERATIONS) {
                const res = await fetch(BASE, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                        model: MODEL,
                        messages: apiMessages,
                        tools: groqTools,
                        tool_choice: 'auto',
                        temperature: 0,
                    }),
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err?.error?.message || res.statusText);
                }

                const data = await res.json();
                const aiMsg = data.choices?.[0]?.message;
                if (!aiMsg) break;

                // Push assistant message to API history
                apiMessages.push(aiMsg);

                // If text is present, show it
                if (aiMsg.content) {
                    addMessage({ role: 'assistant', text: aiMsg.content });
                    hasAddedAssistantReply = true;
                }

                if (!aiMsg.tool_calls || aiMsg.tool_calls.length === 0) {
                    // If we haven't added any text yet but it's stopping, add a fallback
                    if (!hasAddedAssistantReply) {
                        addMessage({ role: 'assistant', text: "I've processed your request. Is there anything else you'd like me to help with?" });
                    }
                    break;
                }

                // Execute tools
                for (const tc of aiMsg.tool_calls) {
                    const fc = tc.function;

                    addMessage({
                        role: 'tool_status',
                        text: `⚙️ Calling: **${fc.name.replace(/_/g, ' ')}**...`,
                    });

                    let args = {};
                    try {
                        args = typeof fc.arguments === 'string' ? JSON.parse(fc.arguments) : (fc.arguments || {});
                    } catch (e) { console.error('Args parse error', fc.arguments); }

                    const result = await executeTool(fc.name, args);

                    addMessage({
                        role: 'tool_status',
                        text: `✅ Data received: **${fc.name.replace(/_/g, ' ')}**`,
                    });

                    apiMessages.push({
                        role: 'tool',
                        name: fc.name,
                        tool_call_id: tc.id,
                        content: String(result),
                    });
                }

                iteration++;
            }
        } catch (err: any) {
            addMessage({
                role: 'assistant',
                text: `❌ Error: ${err.message || 'Unknown error'}`,
            });
        } finally {
            setIsThinking(false);
        }
    };


    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const renderText = (text: string) => {
        // Simple markdown-like rendering: **bold**, bullet points, newlines
        return text.split('\n').map((line, i) => {
            const boldLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            return (
                <span key={i}>
                    <span dangerouslySetInnerHTML={{ __html: boldLine }} />
                    {i < text.split('\n').length - 1 && <br />}
                </span>
            );
        });
    };

    const contextColors: Record<PageContext, string> = {
        hospital: 'from-[#ee2b2b] to-red-700',
        donor: 'from-blue-600 to-blue-800',
        admin: 'from-slate-700 to-slate-900',
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
                    />

                    {/* Chat window */}
                    <motion.div
                        initial={{ opacity: 0, y: 60, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 60, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-4 right-4 w-[400px] max-h-[620px] bg-white rounded-2xl shadow-2xl z-50 overflow-hidden border border-slate-200 flex flex-col"
                        style={{ height: '620px' }}
                    >
                        {/* Header */}
                        <div className={cn('bg-gradient-to-r p-4 flex items-center justify-between text-white', contextColors[context])}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-lg">psychology</span>
                                </div>
                                <div>
                                    <h3 className="font-black text-sm">LifeLink AI</h3>
                                    <p className="text-[10px] text-white/70 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
                                        {contextLabels[context]} • Agentic Mode
                                    </p>
                                </div>
                            </div>
                            <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                            {messages.map(msg => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={cn(
                                        'flex',
                                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                                    )}
                                >
                                    {msg.role === 'tool_status' ? (
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold italic bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                                            <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                            {renderText(msg.text)}
                                        </div>
                                    ) : (
                                        <div className={cn(
                                            'max-w-[85%] flex flex-col',
                                            msg.role === 'user' ? 'items-end' : 'items-start'
                                        )}>
                                            {msg.role === 'assistant' && (
                                                <div className="w-6 h-6 bg-gradient-to-br from-[#ee2b2b] to-red-700 rounded-lg flex items-center justify-center mb-1">
                                                    <span className="material-symbols-outlined text-white text-xs">psychology</span>
                                                </div>
                                            )}
                                            <div className={cn(
                                                'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                                                msg.role === 'user'
                                                    ? 'bg-[#ee2b2b] text-white rounded-tr-sm'
                                                    : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
                                            )}>
                                                {renderText(msg.text)}
                                            </div>
                                            <span className="text-[9px] text-slate-400 mt-1 px-1">{msg.time}</span>
                                        </div>
                                    )}
                                </motion.div>
                            ))}

                            {/* Thinking indicator */}
                            {isThinking && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex justify-start"
                                >
                                    <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                                        <div className="flex gap-1">
                                            {[0, 1, 2].map(i => (
                                                <motion.div
                                                    key={i}
                                                    className="w-1.5 h-1.5 bg-[#ee2b2b] rounded-full"
                                                    animate={{ y: [0, -4, 0] }}
                                                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-xs text-slate-400 font-bold">Thinking...</span>
                                    </div>
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>

                        {/* Suggested prompts (only at start) */}
                        {messages.length <= 1 && (
                            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Try asking:</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {suggestedPrompts[context].map((prompt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSend(prompt)}
                                            className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200 hover:border-[#ee2b2b] hover:text-[#ee2b2b] px-2.5 py-1 rounded-full transition-all"
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Input */}
                        <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isThinking ? 'AI is thinking...' : 'Ask anything or give a command...'}
                                disabled={isThinking}
                                className="flex-1 bg-slate-100 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-[#ee2b2b]/30 outline-none disabled:opacity-60 transition-all"
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={!input.trim() || isThinking}
                                className="w-10 h-10 bg-[#ee2b2b] text-white rounded-xl flex items-center justify-center hover:bg-[#ee2b2b]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                            >
                                <span className="material-symbols-outlined text-lg">send</span>
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
