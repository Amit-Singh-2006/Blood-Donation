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
| Every signed-in request also checks that the account still exists and is not deactivated (remembered for 15 seconds per account), so a deactivated or deleted account loses access at once, on every server instance, instead of when its 30-minute token expires | `authMiddleware.ts` |
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
| The first, national admin signs up with `ADMIN_INVITE_CODE` from the server's environment, which works only while no admin exists | `authController.ts → register()` |
| Every other admin needs a personal, single-use invite from a national admin, issued for one email address and one jurisdiction; only its hash is stored | `adminController.ts`, `utils/adminInvites.ts` |
| Admins and hospitals sign in with an authenticator app (two-step sign-in) | `authController.ts`, `utils/mfa.ts` |
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
| A donor-network entry belongs to one website account: a phone number linked to another account is refused (409), so nobody can read or answer someone else's alerts by signing up with their number | `network/engine.ts`, `donorController.ts` |
| One-tap links carry a secret per alert (donors) or per request (hospitals); the hospital token never leaves the server or the hospital's own view | `network/replies.ts`, `hospitalController.ts` |
| Reviews are accepted only for a donation or campaign the reviewer took part in | `reviewController.ts` |
| A certificate is issued only for a donation recorded against the signed-in donor's own account | `certificateController.ts` |
| Admins can deactivate only donors and hospitals in their own jurisdiction, never other admins | `adminController.ts → setUserActive()` |

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
| The website sends its own CSP: scripts only from LifeLink itself (no inline scripts, no `eval`), network calls only to the LifeLink API and GitHub's release API, styles and fonts from Google Fonts, map tiles from OpenStreetMap, no plugins (`object-src 'none'`) | `vercel.json` |
| `noSniff: true` (X-Content-Type-Options) prevents MIME confusion XSS | `app.ts → Helmet config` |
| HttpOnly cookies prevent JS from reaching the auth token even in an XSS scenario | `authController.ts` |
| React escapes everything it renders; the assistant's messages are built as React elements, never as HTML | `AgentChat.tsx` |
| Campaign map links must be `http(s)` (no `javascript:` or `data:` links) | `campaignSchemas.ts` |
| The website forbids framing (`X-Frame-Options: DENY`, `frame-ancestors 'none'`), so it cannot be clickjacked | `vercel.json` |

---

## 🕸️ Request Attacks

### 15. Cross-Site Request Forgery (CSRF)
| Mitigation | Location |
|---|---|
| `csrfOriginCheck` validates `Origin` / `Referer` header on all `POST`, `PUT`, `DELETE` requests against an allowlist | `securityMiddleware.ts` |
| In production the session cookie is `Secure; SameSite=None; Partitioned`: browsers keep it in LifeLink's own partition, so another site's pages never carry it | `utils/authCookie.ts` |
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
| The only uploads are hospital verification documents, accepted only from a signed-in hospital, before it is verified, and rate-limited per account | `hospitalRoutes.ts`, `verificationController.ts` |
| A file's type comes from its first bytes (PDF, JPEG, PNG or WebP only) and must match the type sent; anything else, including HTML or SVG renamed as a PDF, is refused. PDFs with scripts, launch actions or attached files are refused | `utils/documents.ts` |
| Each file is capped at 3 MB (the parser stops reading beyond it); other request bodies stay capped at 10 KB | `hospitalRoutes.ts`, `app.ts` |
| Files are stored in the database (no file paths or user-supplied names are ever used) and only reach the hospital itself and the admins of its city | `verificationController.ts` |
| Files are sent back as downloads with our own type and name, `nosniff`, a sandboxing CSP and `no-store`; the website shows them from a local copy whose type it sets itself | `utils/documents.ts`, `src/lib/documents.ts` |
| Every time an admin opens a document is logged, and approval needs the approving admin to have opened each current document since its last upload. The approval also carries a fingerprint of the documents it was given, so a file swapped during review is caught. Every upload and decision is logged with who made it | `verificationController.ts` |
| General request bodies are capped at **10 KB** (`express.json({ limit: '10kb' })`) | `app.ts` |

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
| On Vercel and Cloud Run the limits that guard secrets (sign-in, sign-up, two-step codes, password reset, admin invites, account deletion, certificate checks, campaign sign-ups, uploads, the AI assistant) count in Postgres, so they hold across every server instance instead of resetting per instance; a nightly job removes expired counters. Set `RATE_LIMIT_STORE=postgres` to do the same elsewhere | `middleware/rateLimitStore.ts`, `config/initDb.ts` |
| `standardHeaders: true` exposes `RateLimit-*` headers for transparency | All limiters |

### 24. API Abuse
| Mitigation | Location |
|---|---|
| All routes have rate limiters | All route files |
| Bot detection on sign-in and admin endpoints | `authRoutes.ts`, `adminRoutes.ts` |
| The AI assistant is for signed-in accounts only, limited per IP and per account; the server sets its instructions and tools by role, so the Groq key cannot power an arbitrary chatbot | `aiRoutes.ts`, `aiController.ts`, `utils/aiPrompts.ts` |
| Body size limit 10 KB prevents flooding with huge payloads | `app.ts` |

---

## 🗄️ Data Exposure Attacks

### 25. Insecure Direct Object Reference (IDOR)
*(See also: Horizontal Access Control)*
| Mitigation | Location |
|---|---|
| All resource fetches use the **authenticated user's ID** from JWT claims | All controllers |
| Explicit ownership checks where a user-supplied ID is unavoidable (request cancel, live locations, reviews, certificates) | `hospitalController.ts`, `donorController.ts`, `reviewController.ts`, `certificateController.ts` |

### 26. Sensitive Data Exposure
| Mitigation | Location |
|---|---|
| `password_hash` is **never** returned in any response | `authController.ts`, `adminController.ts` |
| Checking a certificate code shows only the donor's first name and initial, the hospital and the date; codes have about 40 bits of randomness and checks are rate-limited | `certificateController.ts`, `certificateRoutes.ts` |
| Global error handler returns generic `"An internal error occurred."` | `app.ts` |
| Stack traces are only logged server-side, never sent to the client | `authController.ts`, `app.ts` |
| Request bodies are never logged (an unreadable body is logged by type only); security logs mask emails (`a***@gmail.com`) | `app.ts`, `securityMiddleware.ts` |
| `X-Powered-By` header hidden | `app.ts → Helmet` |

### 27. Mass Assignment
| Mitigation | Location |
|---|---|
| `massAssignmentGuard(allowedFields)` strips all unexpected fields from `req.body` | `securityMiddleware.ts` |
| Applied on every route that accepts a body, e.g. `/hospital/requests`, `/hospital/inventory`, `/hospital/profile`, `/donor/profile`, `/donor/certificates`, `/user/account` | Route files |
| Zod schemas provide a second enforcement layer | Schema files |

---

## 🌐 Configuration Attacks

### 28. CORS Misconfiguration
| Mitigation | Location |
|---|---|
| `strictCorsGuard` blocks the request at the server level if Origin is not in the allowlist | `securityMiddleware.ts`, `app.ts` |
| `cors()` middleware adds correct CORS response headers | `app.ts` |
| Wildcard (`*`) origin is **never** used | `app.ts` |
| `localhost` origins are trusted only off Vercel (local development), never by the live API | `securityMiddleware.ts` |

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

## 📱 Android App

### 34. App Signing and Fake Updates
| Mitigation | Location |
|---|---|
| The app is a release build (not debuggable) signed with LifeLink's private release key. The key and its password live only on the maintainer's PC and in GitHub secrets, never in git | `mobile/android/app/build.gradle`, `.github/workflows/android.yml` |
| Without the key a release build stops instead of falling back to a debug key, and CI publishes an APK only if its signing certificate matches the pinned SHA-256 fingerprint | `.github/workflows/android.yml` |
| Builds before 2 were signed with a debug key that is public in git history. Newer builds add `LifeLinkApp/<build>` to the user agent, and the website asks older installs to reinstall once the new build is published | `mobile/capacitor.config.json`, `src/components/ReinstallNotice.tsx` |
| No cloud backup of app data, so the "keep me signed in" cookie cannot be restored onto another phone without the account's authenticator | `AndroidManifest.xml` |
| The one native addition, the file-saving plugin, accepts only PDF, PNG, JPEG, WebP, plain text and CSV up to 20 MB, flattens the file name (no `../`), and writes only to Downloads/LifeLink | `mobile/android/.../FilesPlugin.java` |

---

## 👤 Accounts and Personal Data

### 35. Consent, Deletion and Deactivation
| Mitigation | Location |
|---|---|
| Sign-up requires accepting the Terms and Privacy Policy; the accepted version and time are stored with the account. Donors must be 18 to 65 (checked in India time) | `schemas/authSchemas.ts`, `utils/legal.ts` |
| Donors delete their own account with their password: requests they said YES to are handed on first, their contact is removed from request history and queued messages, and everything else goes with the account (database cascades) | `userController.ts → deleteAccount()` |
| A wrong password on deletion answers 403, not 401, so it never signs the donor out | `userController.ts` |
| Admins deactivate abusive accounts with a recorded reason: sign-in and every open session stop at once, kept sign-ins end, a donor stops getting alerts and a hospital's open requests are cancelled | `adminController.ts → setUserActive()`, `authMiddleware.ts`, `authController.ts` |

### 36. The Database Timer
| Mitigation | Location |
|---|---|
| `POST /network/tick` runs only with the `X-LifeLink-Tick` secret, which the database timer sends; the secret is generated inside the database (`app_secrets`) and never leaves it except in that call | `networkController.ts`, `config/initDb.ts` |

### 37. Backups
| Mitigation | Location |
|---|---|
| Daily backups are encrypted (AES-256-GCM, so a changed or cut-short file is detected) with a key kept outside the repository, and each one is test-restored inside a rolled-back transaction before it counts | `server/scripts/backup.ts`, `server/scripts/backupFormat.ts` |
| A restore refuses to write into the live database unless asked explicitly, and only into empty tables | `server/scripts/restore-backup.ts` |

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
