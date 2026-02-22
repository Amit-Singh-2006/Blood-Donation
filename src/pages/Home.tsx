import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, ShieldCheck, Smartphone, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative pt-10 pb-20 lg:pt-20 text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-600 text-sm font-medium mb-6 border border-red-100">
            <Zap className="w-4 h-4 fill-current" />
            <span>Match found in under 5 seconds</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 mb-6">
            Connecting Life Savers <br />
            <span className="text-red-600">Instantly with AI</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Eliminating fragmented manual calls during emergencies. Our AI-driven platform connects hospitals with compatible donors in minutes, not hours.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/hospital"
              className="w-full sm:w-auto px-8 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
            >
              Hospital Request
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/register-donor"
              className="w-full sm:w-auto px-8 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              Donor Registration
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            icon: Zap,
            title: "Instant Matching",
            desc: "ABO/Rh engine matches donors in < 5 seconds based on compatibility."
          },
          {
            icon: Smartphone,
            title: "SMS Fallback",
            desc: "Works via SMS on basic phones. No smartphone required for donors."
          },
          {
            icon: ShieldCheck,
            title: "Smart Ranking",
            desc: "AI ranks donors by proximity, eligibility window, and response history."
          },
          {
            icon: Users,
            title: "Auto-Escalation",
            desc: "Automatically notifies next best donor if the first is unresponsive."
          }
        ].map((feature, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600 mb-4">
              <feature.icon className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg mb-2 text-slate-900">{feature.title}</h3>
            <p className="text-slate-600 text-sm leading-relaxed">{feature.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* Stats / Impact */}
      <section className="bg-slate-900 rounded-3xl p-8 md:p-12 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 grid md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-bold mb-2">3.3M</div>
            <div className="text-slate-400 text-sm uppercase tracking-wider">Unit Annual Gap</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-2">&lt; 15m</div>
            <div className="text-slate-400 text-sm uppercase tracking-wider">Response Time</div>
          </div>
          <div>
            <div className="text-4xl font-bold mb-2">99.5%</div>
            <div className="text-slate-400 text-sm uppercase tracking-wider">Uptime Target</div>
          </div>
        </div>
      </section>
    </div>
  );
}
