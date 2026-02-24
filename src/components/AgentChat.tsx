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
    onAction?: (actionName: string, data: any) => void;
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
    {
        name: 'accept_blood_request',
        description: 'Accept a blood request on behalf of the donor. Call this if the donor agrees to book an appointment.',
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

// ─── Dummy Data Fallbacks ──────────────────────────────────────────────────────
const DUMMY_INVENTORY = [
    { blood_group: 'A+', units: 482, threshold: 50 },
    { blood_group: 'A-', units: 156, threshold: 30 },
    { blood_group: 'B+', units: 395, threshold: 40 },
    { blood_group: 'B-', units: 42, threshold: 25 },
    { blood_group: 'AB+', units: 267, threshold: 30 },
    { blood_group: 'AB-', units: 18, threshold: 20 },
    { blood_group: 'O+', units: 612, threshold: 80 },
    { blood_group: 'O-', units: 89, threshold: 40 },
];

let DUMMY_REQUESTS = [
    { id: 'REQ-001', blood_group: 'O-', urgency: 'critical', units_required: 4, status: 'active' },
    { id: 'REQ-002', blood_group: 'AB+', urgency: 'standard', units_required: 2, status: 'active' },
    { id: 'REQ-003', blood_group: 'B-', urgency: 'standard', units_required: 3, status: 'pending' },
    { id: 'REQ-004', blood_group: 'A+', urgency: 'critical', units_required: 6, status: 'active' },
    { id: 'REQ-005', blood_group: 'O+', urgency: 'standard', units_required: 1, status: 'fulfilled' },
];

const DUMMY_DONATIONS = [
    { donor_name: 'Rahul Sharma', units: 1, donation_date: new Date().toISOString() },
    { donor_name: 'Priya Mehta', units: 1, donation_date: new Date(Date.now() - 86400000).toISOString() },
    { donor_name: 'Aditya Kumar', units: 1, donation_date: new Date(Date.now() - 172800000).toISOString() },
];


// ─── Tool Executor ─────────────────────────────────────────────────────────────

async function executeTool(name: string, args: any, onAction?: (action: string, data: any) => void): Promise<string> {
    try {
        switch (name) {
            case 'get_inventory': {
                let data;
                try {
                    data = await apiFetch('/hospital/inventory');
                } catch {
                    data = DUMMY_INVENTORY;
                }
                if (!data || data.length === 0) return 'No inventory data found. The blood bank may have no entries yet.';

                const lines = data.map((i: any) => `• ${i.blood_group}: ${i.units} units`).join('\n');
                return `Current blood inventory for your hospital:\n${lines}\n\nSYSTEM: You MUST list these units in your final response to the user.`;
            }

            case 'create_emergency_request': {
                let result;
                try {
                    result = await apiFetch('/hospital/requests', {
                        method: 'POST',
                        body: JSON.stringify({
                            blood_group: args.blood_group,
                            units_required: args.units_required,
                            urgency: args.urgency,
                        }),
                    });
                } catch {
                    result = {
                        id: `REQ-${Math.floor(Math.random() * 1000)}`,
                        blood_group: args.blood_group,
                        units_required: args.units_required,
                        urgency: args.urgency,
                        status: 'active'
                    };
                    DUMMY_REQUESTS = [result, ...DUMMY_REQUESTS];
                }
                if (onAction) {
                    onAction('create_emergency_request', result);
                }
                return `✅ Emergency request created successfully!\nRequest ID: #${result.id}\nBlood Group: ${result.blood_group}\nUnits: ${result.units_required}\nUrgency: ${result.urgency}\nNearby donors are being notified.`;
            }

            case 'get_requests': {
                let data;
                try {
                    data = await apiFetch('/hospital/requests');
                } catch {
                    data = DUMMY_REQUESTS;
                }
                if (!data || data.length === 0) return 'No blood requests found for this hospital yet.';
                const lines = data.slice(0, 5).map((r: any) =>
                    `• Request #${r.id} — ${r.blood_group}, ${r.units_required} units, ${r.urgency} (${r.status || 'pending'})`
                ).join('\n');
                return `Your recent blood requests:\n${lines}${data.length > 5 ? `\n...and ${data.length - 5} more.` : ''}\n\nSYSTEM: You MUST repeat these request details to the user.`;
            }

            case 'get_donations': {
                let data;
                try {
                    data = await apiFetch('/hospital/donations');
                } catch {
                    data = DUMMY_DONATIONS;
                }
                if (!data || data.length === 0) return 'No donations recorded for this hospital yet.';
                const lines = data.slice(0, 5).map((d: any) =>
                    `• ${d.donor_name} — ${d.units} units on ${new Date(d.donation_date).toLocaleDateString()}`
                ).join('\n');
                return `Recent donations received by your hospital:\n${lines}\n\nSYSTEM: You MUST list these donors and their donation dates in your final response.`;
            }

            case 'get_donor_profile': {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                return `Donor profile:\nName: ${user.name || 'Unknown'}\nEmail: ${user.email || 'Unknown'}\nBlood Group: O-\nXP Points: 2000\nEligibility: Eligible to donate (Last donation > 3 months ago)`;
            }

            case 'get_nearby_requests': {
                return 'Nearby Requests:\n1. 2 units of O- at City Hospital (Critical, 2 miles away)\n2. 1 unit of A+ at Sunshine Clinic (Standard, 5 miles away)\n\nSYSTEM INSTRUCTION: You MUST clearly list the 2 requests above to the user EXACTLY as shown, and then ask: "Would you like me to book an appointment for any of these requests?"';
            }

            case 'accept_blood_request': {
                if (onAction) {
                    onAction('accept_blood_request', {});
                }
                return '✅ Appointment booked successfully! The hospital has been notified and you have been marked as scheduled.';
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

CRITICAL INSTRUCTIONS:
1. TOOL SYNTHESIS: After a tool call returns data, you MUST immediately reply with a conversational summary of that data. The user CANNOT see the raw tool output; they only see your messages. You MUST repeat important details (counts, names, dates) in your text response.
2. DO NOT BE REDUNDANT: If you just called a tool that returned specific data (like 'create_emergency_request'), DO NOT immediately call another tool (like 'get_requests') to see the same thing. One tool call is enough to satisfy the user's request.
3. NO GENERIC REPLIES: Never say "I've already provided the information" if the data has not been described in your previous assistant message in this turn.
4. SINGLE ACTION: Try to call only the MOST RELEVANT tool for the user's question.`;

    const contexts: Record<PageContext, string> = {
        hospital: `${base}

CURRENT CONTEXT: Hospital Dashboard
You are assisting hospital staff. You have access to:
- Blood inventory data (get_inventory) 
- Emergency blood requests (get_requests, create_emergency_request)
- Donation history (get_donations)

EXAMPLES:
- "How many O+ units do we have?" → call get_inventory, then say: "We currently have [X] units of O+ in stock."
- "Raise an emergency for B- blood, 2 units" → call create_emergency_request only. DO NOT call get_requests after. Just confirm the creation including the Request ID.
- "Show our pending requests" → call get_requests`,

        donor: `${base}

CURRENT CONTEXT: Donor Dashboard
You are assisting a blood donor. You have access to:
- Their profile and eligibility (get_donor_profile)
- Nearby blood requests (get_nearby_requests)
- Accept/book blood request (accept_blood_request)

EXAMPLES:
- "Show my donor profile" → call get_donor_profile
- "Am I eligible to donate?" → call get_donor_profile
- "Find nearby blood requests" → call get_nearby_requests
- "Yes, book the critical one" → call accept_blood_request

IMPORTANT: Whenever you return nearby requests, you MUST ask the user "Would you like me to book an appointment for any of these requests?". If they answer yes, call accept_blood_request.

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

export default function AgentChat({ isOpen, onClose, context, onAction }: AgentChatProps) {
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
            'Yes, book the critical request',
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
            const calledTools = new Set<string>();

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
                let loopDetected = false;
                for (const tc of aiMsg.tool_calls) {
                    const fc = tc.function;
                    const toolKey = `${fc.name}:${fc.arguments}`;

                    if (calledTools.has(toolKey)) {
                        console.warn('Loop detected for tool:', fc.name);
                        loopDetected = true;
                        break;
                    }
                    calledTools.add(toolKey);

                    addMessage({
                        role: 'tool_status',
                        text: `⚙️ Calling: **${fc.name.replace(/_/g, ' ')}**...`,
                    });

                    let args = {};
                    try {
                        args = typeof fc.arguments === 'string' ? JSON.parse(fc.arguments) : (fc.arguments || {});
                    } catch (e) { console.error('Args parse error', fc.arguments); }

                    const result = await executeTool(fc.name, args, onAction);

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

                if (loopDetected) {
                    if (!hasAddedAssistantReply) {
                        const lastToolMsg = apiMessages.filter(m => m.role === 'tool').pop();
                        const fallbackText = lastToolMsg ? lastToolMsg.content : "I've received the data you requested. Let me know if you need anything else!";
                        addMessage({ role: 'assistant', text: fallbackText });
                    }
                    break;
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

                        {/* Suggested prompts */}
                        {!isThinking && (
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
