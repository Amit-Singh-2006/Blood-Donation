import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes';
import donorRoutes from './routes/donorRoutes';
import hospitalRoutes from './routes/hospitalRoutes';
import adminRoutes from './routes/adminRoutes';
import userRoutes from './routes/userRoutes';
import rateLimit from 'express-rate-limit';

// ── Security Middleware ────────────────────────────────────────────────────
import {
    xssSanitizer,
    injectionGuard,
    pathTraversalGuard,
    csrfOriginCheck,
    verbTamperingGuard,
    forcedBrowsingGuard,
    strictCorsGuard,
    checkTokenBlacklist,
} from './middleware/securityMiddleware';

dotenv.config();

const app = express();

// ──────────────────────────────────────────────────────────────────────────
// 1. HTTP Security Headers (Helmet)
//    Covers: XSS headers, Clickjacking, MIME sniffing, CSP, HSTS
// ──────────────────────────────────────────────────────────────────────────
app.use(helmet({
    // Hide X-Powered-By to avoid revealing the stack to attackers
    hidePoweredBy: true,

    // Content-Security-Policy: restrict resource origins
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "http://localhost:5173", "https://jadmqstbutzbclbuqium.supabase.co"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],     // Prevent clickjacking
            upgradeInsecureRequests: [],
        },
    },

    // Prevent MIME-type sniffing → blocks Stored XSS via file upload tricks
    noSniff: true,

    // Anti-clickjacking
    frameguard: { action: 'deny' },

    // HTTP Strict Transport Security (enable in production on HTTPS)
    // hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },

    crossOriginResourcePolicy: false,
}));

// ──────────────────────────────────────────────────────────────────────────
// 2. HTTP Verb Tampering Guard
//    Rejects TRACE, CONNECT, PATCH, etc. — before any route is touched
// ──────────────────────────────────────────────────────────────────────────
app.use(verbTamperingGuard);

// ──────────────────────────────────────────────────────────────────────────
// 3. CORS – First enforce strict server-side check, then apply CORS headers
//    Covers: CORS Misconfiguration exploitation
// ──────────────────────────────────────────────────────────────────────────
// Dynamically build the allowed origins list.
// Add FRONTEND_URL env var in your Vercel backend project settings
// to allow your deployed frontend (e.g. https://blood-donation-frontend.vercel.app)
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

app.use(strictCorsGuard);
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));

// ──────────────────────────────────────────────────────────────────────────
// 4. Body parsing (must come before sanitizers that mutate req.body)
// ──────────────────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));   // Limit body size → DoS mitigation
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ──────────────────────────────────────────────────────────────────────────
// 5. Path Traversal Prevention
//    Detect ../ sequences before anything else reads the URL
// ──────────────────────────────────────────────────────────────────────────
app.use(pathTraversalGuard);

// ──────────────────────────────────────────────────────────────────────────
// 6. Injection Guards (NoSQL / LDAP)
//    SQL injection is handled by parameterised queries (pg driver).
//    This layer catches NoSQL operators and LDAP special characters.
// ──────────────────────────────────────────────────────────────────────────
app.use(injectionGuard);

// ──────────────────────────────────────────────────────────────────────────
// 7. XSS Sanitization
//    Strip script tags, inline event handlers, and javascript: URIs
//    from all inbound string values (body + query params).
//    Covers: Reflected XSS, Stored XSS, DOM-based XSS via query strings.
// ──────────────────────────────────────────────────────────────────────────
app.use(xssSanitizer);

// ──────────────────────────────────────────────────────────────────────────
// 8. CSRF Origin Check
//    Validates Origin / Referer on state-mutating requests.
//    Complements HttpOnly cookie-based auth (no JS CSRF token access).
// ──────────────────────────────────────────────────────────────────────────
app.use(csrfOriginCheck);

// ──────────────────────────────────────────────────────────────────────────
// 9. JWT Blacklist Check (Token Replay Attack Prevention)
//    Must run BEFORE routes but after cookie-parser.
// ──────────────────────────────────────────────────────────────────────────
app.use(checkTokenBlacklist);

// ──────────────────────────────────────────────────────────────────────────
// 10. Forced Browsing Guard
//     Blocks unauthenticated access to protected path prefixes even if
//     individual route middleware is accidentally missing.
// ──────────────────────────────────────────────────────────────────────────
app.use(forcedBrowsingGuard);

// ──────────────────────────────────────────────────────────────────────────
// 11. Global Rate Limit (Abuse / DoS / DDoS mitigation)
//     A broad rate limit on the entire API.  Individual routes (auth, admin)
//     have tighter, route-specific limits defined in their route files.
// ──────────────────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 200,                     // 200 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests from this IP, please try again later.' },
});
app.use(globalLimiter);

// ──────────────────────────────────────────────────────────────────────────
// 12. Routes
// ──────────────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/donor', donorRoutes);
app.use('/hospital', hospitalRoutes);
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);

// ──────────────────────────────────────────────────────────────────────────
// 13. Health Check (public)
// ──────────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.send('Blood Donation Management API is running');
});

// ──────────────────────────────────────────────────────────────────────────
// 14. 404 Handler – prevents Directory Listing / Forced Browsing info leaks
// ──────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ message: 'Not found.' });
});

// ──────────────────────────────────────────────────────────────────────────
// 15. Global Error Handler – never leak stack traces to clients
// ──────────────────────────────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[ERROR]', err);
    res.status(err.status || 500).json({ message: 'An internal error occurred.' });
});

export default app;
