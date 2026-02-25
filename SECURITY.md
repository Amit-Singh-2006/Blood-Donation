# 🛡️ Security Architecture – Blood Donation Management System

## Overview

This document maps every attack category from OWASP / CTF challenge lists to the **specific code** in this project that mitigates it.

---

## 🔐 Authentication Attacks

### 1. Broken Authentication
| Mitigation | Location |
|---|---|
| Passwords hashed with bcrypt (cost factor **12**) | `authController.ts → register()` |
| JWT signed with a 512-bit secret from env | `authController.ts → login()` |
| HttpOnly, SameSite=Lax, Secure cookie | `authController.ts → login()` |
| Zod schema validates email + strong password on every request | `authSchemas.ts` |

### 2. Session Hijacking
| Mitigation | Location |
|---|---|
| `HttpOnly` cookie prevents JavaScript from reading the token (XSS cannot steal it) | `authController.ts` |
| `Secure` flag ensures cookie only travels over HTTPS in production | `authController.ts` |
| `SameSite=Lax` reduces CSRF risk | `authController.ts` |
| 30-minute token TTL limits the window of a hijacked session | `authController.ts` |

### 3. JWT Tampering
| Mitigation | Location |
|---|---|
| Token is verified server-side with `jwt.verify()` on every protected request | `authMiddleware.ts` |
| Admin role is **double-verified against the database** (not just the token) | `requireAdmin.ts` |
| Any unexpected `alg: none` or forged signature → `jwt.verify()` throws | `authMiddleware.ts` |

### 4. Token Replay Attack
| Mitigation | Location |
|---|---|
| On **logout**, token is added to an in-memory blacklist | `securityMiddleware.ts → blacklistToken()` |
| `checkTokenBlacklist` middleware rejects blacklisted tokens before they reach routes | `securityMiddleware.ts`, `app.ts` |
| Blacklist entries self-expire after 30 minutes (matching token TTL) | `securityMiddleware.ts` |

### 5. Session Fixation
| Mitigation | Location |
|---|---|
| `preventSessionFixation` middleware clears any **pre-existing** token cookie before login/register | `securityMiddleware.ts`, `authRoutes.ts` |
| `authController.ts` always issues a **brand new JWT** on successful login | `authController.ts → login()` |

---

## 👑 Authorization Attacks

### 6. Privilege Escalation
| Mitigation | Location |
|---|---|
| Admin registration requires a secret `ADMIN_INVITE_CODE` from `.env` | `authController.ts → register()` |
| Only **one** admin account can ever exist (DB check) | `authController.ts → register()` |
| `roleMiddleware` restricts routes by role (`donor`, `hospital`, `admin`) | `roleMiddleware.ts` |
| Strong password policy reduces the chance of guessing an admin password | `authSchemas.ts` |

### 7. Vertical Access Control Bypass
| Mitigation | Location |
|---|---|
| Every protected route requires both `authMiddleware` AND `roleMiddleware` | All route files |
| Admin routes add a third layer: `requireAdmin` verifies role in DB | `requireAdmin.ts`, `adminRoutes.ts` |

### 8. Horizontal Access Control (IDOR)
| Mitigation | Location |
|---|---|
| `getHospitalDonations`, `getHospitalInventory`, etc. use `req.user.id` from the JWT — NOT a user-supplied ID | `hospitalController.ts` |
| `getPotentialDonors` explicitly checks `request.hospital_id !== hospitalId` | `hospitalController.ts` |
| `markNotificationRead` adds `AND user_id = $2` to the UPDATE query | `userController.ts` |

### 9. Forced Browsing
| Mitigation | Location |
|---|---|
| `forcedBrowsingGuard` in `app.ts` blocks ALL requests to `/admin`, `/donor`, `/hospital`, `/user` that lack a token — even if a route accidentally loses its middleware | `securityMiddleware.ts`, `app.ts` |
| 404 handler returns `{ message: "Not found." }` without leaking path info | `app.ts` |

---

## 💉 Injection Attacks

### 10. SQL Injection (SQLi)
| Mitigation | Location |
|---|---|
| **All** database queries use `$1, $2, ...` parameterized placeholders via the `pg` driver | Every controller file |
| No dynamic string concatenation for SQL | All controllers |

### 11. Command Injection
| Mitigation | Location |
|---|---|
| No `exec`, `spawn`, or shell commands anywhere in the codebase | N/A |
| `xssSanitizer` strips script/command injection strings from inputs | `securityMiddleware.ts` |

### 12. NoSQL Injection
| Mitigation | Location |
|---|---|
| `injectionGuard` detects `$where`, `$gt`, `$regex`, etc. and blocks the request | `securityMiddleware.ts` |
| Applied globally in `app.ts` before any route runs | `app.ts` |

### 13. LDAP Injection
| Mitigation | Location |
|---|---|
| `injectionGuard` detects LDAP special chars `()\\*\x00` and logical operators | `securityMiddleware.ts` |

---

## 🧬 Client-Side Attacks

### 14. Cross-Site Scripting (XSS) — All variants
| Mitigation | Location |
|---|---|
| **Stored XSS**: `xssSanitizer` strips `<script>`, inline event handlers, `javascript:` URIs from `req.body` before it hits the DB | `securityMiddleware.ts` |
| **Reflected XSS**: Same sanitizer applied to `req.query` | `securityMiddleware.ts` |
| **DOM-Based XSS**: query string sanitization removes vectors | `securityMiddleware.ts` |
| `Content-Security-Policy` header via Helmet blocks inline scripts even if one slips through | `app.ts → Helmet config` |
| `noSniff: true` (X-Content-Type-Options) prevents MIME confusion XSS | `app.ts → Helmet config` |
| HttpOnly cookies prevent JS from reaching the auth token even in an XSS scenario | `authController.ts` |

---

## 🕸️ Request Attacks

### 15. Cross-Site Request Forgery (CSRF)
| Mitigation | Location |
|---|---|
| `csrfOriginCheck` validates `Origin` / `Referer` header on all `POST`, `PUT`, `DELETE` requests against an allowlist | `securityMiddleware.ts` |
| `SameSite=Lax` cookie attribute prevents the cookie from being sent with cross-site form submissions | `authController.ts` |
| Combined effect: cross-site forms cannot both trigger the request AND carry the cookie | Both |

### 16. Parameter Tampering
| Mitigation | Location |
|---|---|
| `massAssignmentGuard` whitelists only expected fields; extra parameters are stripped | `securityMiddleware.ts` |
| Zod schemas provide a second validation layer after the whitelist | Schema files |
| Controllers use `req.user.id` from JWT for ownership, ignoring body-supplied IDs | All controllers |

### 17. HTTP Verb Tampering
| Mitigation | Location |
|---|---|
| `verbTamperingGuard` allows only `GET, POST, PUT, DELETE, OPTIONS, HEAD`; rejects TRACE, CONNECT, PATCH, etc. | `securityMiddleware.ts`, `app.ts` |

---

## 📂 File & Path Attacks

### 18. Path Traversal
| Mitigation | Location |
|---|---|
| `pathTraversalGuard` detects `../`, `..\`, URL-encoded variants in the full URL and query | `securityMiddleware.ts`, `app.ts` |

### 19. Arbitrary File Upload
| Mitigation | Location |
|---|---|
| No file upload endpoints exist in this API | N/A |
| Body size is capped at **10 KB** (`express.json({ limit: '10kb' })`) | `app.ts` |

### 20. Remote / Local File Inclusion
| Mitigation | Location |
|---|---|
| No `require()` or `fs.readFile()` with user-supplied paths anywhere | N/A |
| `xssSanitizer` strips `data:text/html` URI schemes | `securityMiddleware.ts` |

---

## 🚀 Abuse Attacks

### 21. Brute Force Attack
| Mitigation | Location |
|---|---|
| `loginLimiter`: hard blocks after **5 attempts** in 15 minutes per IP | `authRoutes.ts` |
| `bruteForceDelay`: adds progressive delay (500ms × failures, up to 3s) | `securityMiddleware.ts`, `authRoutes.ts` |
| `recordFailedAttempt` / `clearFailedAttempts` track state per IP | `securityMiddleware.ts`, `authController.ts` |
| Constant-time bcrypt comparison prevents timing-based enumeration | `authController.ts → login()` |

### 22. Credential Stuffing
| Mitigation | Location |
|---|---|
| Same rate-limiter + delay as brute force applies | `authRoutes.ts` |
| Strong password policy forces passwords that aren't in common wordlists | `authSchemas.ts` |
| Bot detection blocks known scripting tools (curl, python-requests, etc.) | `securityMiddleware.ts`, `authRoutes.ts` |

### 23. Rate Limit Bypass
| Mitigation | Location |
|---|---|
| Global limiter: 200 req / 15 min per IP on all routes | `app.ts` |
| Per-route limiters with tighter limits on auth (5), admin (30), API (60) | `authRoutes.ts`, `adminRoutes.ts`, other route files |
| `standardHeaders: true` exposes `RateLimit-*` headers for transparency | All limiters |

### 24. API Abuse
| Mitigation | Location |
|---|---|
| All routes have rate limiters | All route files |
| Bot detection on sensitive endpoints | `authRoutes.ts`, `adminRoutes.ts`, `donorRoutes.ts` |
| Body size limit 10 KB prevents flooding with huge payloads | `app.ts` |

---

## 🗄️ Data Exposure Attacks

### 25. Insecure Direct Object Reference (IDOR)
*(See also: Horizontal Access Control)*
| Mitigation | Location |
|---|---|
| All resource fetches use the **authenticated user's ID** from JWT claims | All controllers |
| Explicit ownership checks where a user-supplied ID is unavoidable | `hospitalController.ts → getPotentialDonors()` |
| `markNotificationRead` scopes UPDATE to `AND user_id = $2` | `userController.ts` |

### 26. Sensitive Data Exposure
| Mitigation | Location |
|---|---|
| `password_hash` is **never** returned in any response | `authController.ts`, `adminController.ts` |
| `getAllUsers` returns only `id, name, email, role` (not password or tokens) | `adminController.ts` |
| Global error handler returns generic `"An internal error occurred."` | `app.ts` |
| Stack traces are only logged server-side, never sent to the client | `authController.ts`, `app.ts` |
| `X-Powered-By` header hidden | `app.ts → Helmet` |

### 27. Mass Assignment
| Mitigation | Location |
|---|---|
| `massAssignmentGuard(allowedFields)` strips all unexpected fields from `req.body` | `securityMiddleware.ts` |
| Applied on: `/hospital/requests`, `/hospital/inventory`, `/hospital/verify-donation`, `/user/profile` | Route files |
| Zod schemas provide a second enforcement layer | Schema files |

---

## 🌐 Configuration Attacks

### 28. CORS Misconfiguration
| Mitigation | Location |
|---|---|
| `strictCorsGuard` blocks the request at the server level if Origin is not in the allowlist | `securityMiddleware.ts`, `app.ts` |
| `cors()` middleware adds correct CORS response headers | `app.ts` |
| Wildcard (`*`) origin is **never** used | `app.ts` |

### 29. Security Misconfiguration
| Mitigation | Location |
|---|---|
| Helmet sets 10+ security headers automatically | `app.ts` |
| `X-Powered-By` hidden | `app.ts` |
| CSP, noSniff, frameguard all configured | `app.ts` |
| ADMIN_INVITE_CODE in `.env` (never hardcoded) | `authController.ts` |

### 30. Directory Listing
| Mitigation | Location |
|---|---|
| No static file serving that could expose directory contents | N/A |
| 404 handler catches unknown routes and returns a clean JSON response | `app.ts` |

---

## 🤖 Automation Attacks

### 31. Bot Scraping
| Mitigation | Location |
|---|---|
| `botDetection` middleware blocks known bad User-Agent strings (curl, wget, scrapy, sqlmap, hydra, etc.) | `securityMiddleware.ts` |
| Applied on: login, register, admin routes, leaderboard | Route files |

### 32. Denial of Service (DoS)
| Mitigation | Location |
|---|---|
| Global rate limiter (200 req/15 min) | `app.ts` |
| Body size limit 10 KB | `app.ts` |
| `bruteForceDelay` ties up attacker threads with artificial sleeps | `securityMiddleware.ts` |

### 33. Distributed DoS (DDoS)
| Mitigation | Location |
|---|---|
| All rate limiters are per-IP | All route files |
| For production DDoS: deploy behind Cloudflare / AWS Shield (outside codebase scope) | Infrastructure |

---

## 📊 Security Layer Summary

```
Request → verbTamperingGuard → strictCorsGuard → CORS headers
        → body parsing (10KB limit)
        → pathTraversalGuard
        → injectionGuard (NoSQL/LDAP)
        → xssSanitizer
        → csrfOriginCheck
        → checkTokenBlacklist
        → forcedBrowsingGuard
        → globalRateLimiter
        → [Route-specific: botDetection, rateLimit, preventSessionFixation]
        → [Auth: authMiddleware (JWT verify)]
        → [Role: roleMiddleware OR requireAdmin (DB-verified)]
        → [Input: massAssignmentGuard → Zod schema validation]
        → Controller (parameterized SQL queries)
```
