"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.pool = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
    max: 5, // limit concurrent connections for Supabase pooler
    idleTimeoutMillis: 30000, // close idle clients after 30s
    connectionTimeoutMillis: 10000, // fail fast if can't connect in 10s
    keepAlive: true,
});
exports.pool.connect()
    .then(client => { client.release(); }) // silently confirm connection
    .catch((err) => { if (process.env.NODE_ENV !== 'production')
    console.error('DB connection error:', err.message); });
const query = (text, params) => exports.pool.query(text, params);
exports.query = query;
exports.default = exports.pool;
//# sourceMappingURL=db.js.map