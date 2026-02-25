"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const donorRoutes_1 = __importDefault(require("./routes/donorRoutes"));
const hospitalRoutes_1 = __importDefault(require("./routes/hospitalRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Generate secure HTTP headers with custom CSP
app.use((0, helmet_1.default)({
    // Disable X-Powered-By header to hide stack info from attackers
    hidePoweredBy: true,
    // Content-Security-Policy: restrict what resources can load
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline needed for many frontend frameworks
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "http://localhost:5173", "https://jadmqstbutzbclbuqium.supabase.co"],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"], // Prevent clickjacking
            upgradeInsecureRequests: [],
        },
    },
    // Prevent browsers from MIME-sniffing
    noSniff: true,
    // Clickjacking protection
    frameguard: { action: 'deny' },
    // HSTS (uncomment in production)
    // hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
app.use((0, cors_1.default)({
    origin: 'http://localhost:5173',
    credentials: true,
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/auth', authRoutes_1.default);
app.use('/donor', donorRoutes_1.default);
app.use('/hospital', hospitalRoutes_1.default);
app.use('/admin', adminRoutes_1.default);
app.use('/user', userRoutes_1.default);
app.get('/', (req, res) => {
    res.send('Blood Donation Management API is running');
});
exports.default = app;
//# sourceMappingURL=app.js.map