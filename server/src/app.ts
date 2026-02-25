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

dotenv.config();

const app = express();

// Generate secure HTTP headers with custom CSP
app.use(helmet({
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
    crossOriginResourcePolicy: false,
}));

app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000', 'http://localhost:5000', 'http://127.0.0.1:5000'],
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/donor', donorRoutes);
app.use('/hospital', hospitalRoutes);
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);

app.get('/', (req, res) => {
    res.send('Blood Donation Management API is running');
});

export default app;
