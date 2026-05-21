# Feature Landscape: Dance Studio Management

**Domain:** Dance studio management platform (single-location, 75-150 students)
**Researched:** 2026-05-21
**Competitors surveyed:** Jackrabbit Dance, DanceStudio-Pro (Studio Pro), Studio Director, ClassJuggler, Mindbody, Vagaro, WellnessLiving, iClassPro, Akada, Activity Messenger

---

## Table Stakes

Features every competitor has. Missing = product feels incomplete. Users leave for a platform that has them.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Student/family CRUD** | Core data model — everything else hangs off it. Multi-child families are the norm. | Low | Family account with multiple students under one login/billing relationship |
| **Class scheduling (weekly calendar)** | Studios operate on weekly recurring schedules. Staff and parents both need to see what's running. | Medium | Recurring class slots, not one-off events |
| **Roster-based attendance marking** | The core daily action. Every competitor has it; it's the thing instructors do in every single class. | Low | Present/absent/late/excused statuses are the industry standard four |
| **Online enrollment / registration** | Parents expect to enroll online at 10pm from their phone. Studios that require phone calls lose enrollments. | Medium | Open enrollment periods, waitlists when class is full |
| **Recurring tuition billing** | Monthly autopay is the industry standard. Manual invoicing is a dealbreaker for studios at any scale. | Medium | Monthly recurring via stored card/ACH; autopay authorization on file |
| **Failed payment recovery (dunning)** | Cards expire, decline. Studios need automated retry + parent notification. Manual follow-up doesn't scale even at 75 students. | Medium | Retry logic, parent email/SMS when card fails, link to update payment method |
| **Parent portal** | Parents expect self-service: see enrolled classes, view/pay invoices, update contact info. Eliminating phone calls is the point. | Medium | Web-based (PWA sufficient); authenticated per-family access |
| **Invoices and payment history** | Parents need to see what they owe and what they've paid. Required for trust and for their own records. | Low | Per-family ledger, downloadable receipts |
| **Email notifications** | Enrollment confirmations, payment receipts, absence alerts. Parents expect transactional email. | Low | Triggered by system events; not a marketing tool |
| **Role-based staff access** | Admin/owner, instructor, front desk have different permission needs. Instructor seeing billing data is a problem. | Low | Three roles covers the full industry (admin, instructor, front desk) |
| **Basic financial reporting** | Studio owner needs to see revenue, outstanding balances, enrollment counts. Every competitor provides this. | Low-Med | Monthly revenue, accounts receivable, enrollment summary |
| **Waitlist management** | Classes fill. Studios need to auto-notify the next person when a spot opens. | Low | Queue per class; auto-email on spot opening |

---

## Differentiators

Features that set the platform apart. Not universally expected, but valued when present. The best competitors have one or two of these done exceptionally well.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Sub-30-second attendance flow** | Jackrabbit's biggest user complaint is "too many clicks." A front-desk workflow that a low-tech user completes in under 30 seconds on an iPad is a genuine differentiator. No competitor has solved this specifically. | High (UX) | Large tap targets (56px+), 18px+ text, minimal screens between "open app" and "class saved." This is LSODance's core value. |
| **Offline-first attendance** | Dance studios often have spotty WiFi. Attendance must work regardless. No competitor surfaces this as a named capability. | High (engineering) | IndexedDB queue + sync on reconnect. Instructors mark attendance offline; it syncs when back online. |
| **RFID / automated check-in** | Raspberry Pi + card reader for automated student check-in. Parents tap a card, student is marked present. Rare in this market — mostly seen in gym software. | Medium (infra) | POST /rfid/checkin endpoint; maps card UID to student; supports both manual and RFID attendance in parallel |
| **Recital and event management** | Studio Pro's "Recital Wizard" is a genuine differentiator for them. For a studio doing an annual recital at the Detroit Opera House, this matters significantly. | High | Act lineup, running order, quick-change warnings, volunteer assignments |
| **Costume tracking with size management** | Jackrabbit has auto-size logic; Studio Pro has a Costume Console. Collecting measurements, assigning sizes per class, tracking costume orders. Studios lose hours on this manually. | Medium | Measurements per student per class, costume assignment, order tracking |
| **SMS absence alerts** | Most platforms do email. SMS reaches parents immediately. Especially valuable for last-minute cancellations or class changes. | Low (with Twilio) | Absent alert triggers SMS to parent. Announcement broadcast via SMS. |
| **Accessibility-first design** | No competitor explicitly targets elderly or low-tech front-desk staff. Atkinson Hyperlegible + 18px+ body text + high-contrast palette is genuinely unusual. | Low (design) | Non-negotiable for Mrs. Goodman. Competitive advantage for any studio with similar staff demographics. |
| **Makeup class scheduling** | iClassPro does this well; most don't. When a student misses class, they can request a makeup in another class that has capacity. | Medium | Tracks missed classes per student; allows enrollment in a makeup slot; caps makeup capacity |
| **Student progress / skill tracking** | iClassPro and Swyvel offer this. Instructors log skill milestones; parents see progress. Valuable for families with long-term students. | Medium | Per-student skill log tied to class/level; visible in parent portal |
| **Multi-tenant architecture** | Invisible to the current user but enables future licensing to other studios. No migration required when the second studio comes on. | Medium (schema) | organization_id on every table from day one |

---

## Anti-Features

Things to deliberately NOT build. Either they create bloat, don't serve this studio's actual needs, or compete poorly against entrenched players.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Consumer marketplace / discovery** | Mindbody's defining feature is a consumer app where people find and book studios. Competing here requires a network effect that doesn't exist. LSODance has its community; it doesn't need to acquire strangers. | Direct enrollment via studio website link. The parent portal IS the booking interface. |
| **QuickBooks / accounting integration** | Every major competitor offers this. It adds complexity. At 75-150 students, Stripe's dashboard handles financials adequately. Already listed as explicitly out of scope. | Stripe handles billing; owner reviews Stripe dashboard. No integration needed at this scale. |
| **Branded consumer mobile app (iOS/Android)** | Native apps cost money (Apple/Google dev accounts, app store delays, native build pipeline). A PWA installed to home screen covers the same use case for a studio this size. | PWA with offline support. Add-to-home-screen prompt. iOS Safari + Android Chrome both support PWA installation. |
| **Real-time chat / messaging** | No dance studio at 75-150 students needs Slack-style chat. Email and SMS reach parents where they are. Building a chat system creates a communication channel nobody checks reliably. | Email for announcements, SMS for urgent/absence alerts. |
| **AI email generation** | Jackrabbit launched "Zippy AI" for this. It's a gimmick for a studio owner who already knows what to say to her community of 22 years. | Pre-written email templates with variable substitution. Owner writes the email; the system sends it reliably. |
| **Lead CRM / prospect pipeline** | Studio Pro, Swyvel, and Enrollio target acquisition-focused studios. LSODance is a 22-year established studio in a tight community. They don't need a sales funnel. | Simple inquiry form that emails the studio. No pipeline tracking. |
| **Multi-location / franchise tools** | Amilia and Mindbody compete here. Not relevant for a single-studio operation. | Multi-tenant schema supports future expansion; build single-location tools now. |
| **Livestreaming / virtual classes** | Post-COVID feature most studios added then abandoned. In-person studio only. Already listed as explicitly out of scope. | Not built. Not referenced. |
| **Point-of-sale for merchandise** | Some platforms (WellnessLiving, Mindbody) include merchandise/inventory management. Selling T-shirts at the recital doesn't require POS software. | Manual or Square for in-person merch. Not in the platform. |
| **Complex reporting suite (200+ reports)** | Studio Director advertises 200+ customizable reports. For a 75-150 student studio, this is overwhelming and unused. Users report this as bloat across reviews. | 5-8 pre-built reports: enrollment count, monthly revenue, accounts receivable, class attendance summary, payment history. Owner gets what she needs without configuration. |
| **OAuth / social login** | Adds complexity, dependency on third-party auth providers. Parents at this scale don't benefit meaningfully. Already listed as explicitly out of scope. | Email + password via Supabase Auth. Simple, reliable, no external dependency. |
| **Tiered pricing / plan management** | Jackrabbit charges per student count; Mindbody has complex tiered plans. LSODance has one studio with one pricing model. | Fixed tuition rates per class/season. No plan complexity to manage. |

---

## Feature Dependencies

```
Student/Family CRUD
  └── Enrollment (students must exist before they can be enrolled)
  └── Attendance (rosters come from enrollments)
  └── Billing (invoices are per-family, tied to enrollments)
  └── Parent Portal (authenticated family account)
  └── Notifications (contact info lives on family record)

Class Scheduling
  └── Enrollment (classes must exist before students enroll)
  └── Attendance (class roster is the attendance input)
  └── Recital Management (classes map to recital acts)

Enrollment
  └── Waitlist (waitlist is enrollment-in-waiting)
  └── Makeup Class (requires knowing which enrollment was missed)
  └── Billing (tuition amount tied to enrolled classes)

Recurring Billing
  └── Failed Payment Recovery / Dunning (billing must exist before dunning)
  └── Parent Portal invoice view (invoices must exist to display)

Attendance
  └── Offline Support (attendance must work without network)
  └── RFID Check-in (RFID is an alternate attendance input method)
  └── SMS Absence Alerts (absence notification fires after attendance is marked)

Recital Management
  └── Costume Tracking (costumes are assigned per class/act)
```

---

## MVP Recommendation

For LSODance at launch, prioritize table stakes that serve Mrs. Goodman's core workflow and Carollette's administrative needs. Defer features that require significant complexity without immediate payoff.

**Build first (Phases 1-2):**
1. Staff auth + role-based access (admin, instructor, front desk)
2. Student/family CRUD with enrollment management
3. Class scheduling with visual weekly calendar
4. Roster-based attendance (offline-first, large tap targets) — this is the core value
5. Waitlist management

**Build second (Phases 3-4):**
6. Recurring tuition billing + Stripe integration
7. Failed payment recovery (dunning)
8. Parent portal (class view, invoice view, pay online, update info)
9. Email notifications (transactional — enrollment, payment, absence)
10. SMS notifications (absence alerts + announcements via Twilio)

**Build third (Phases 5+):**
11. Admin dashboard with KPIs and pre-built reports
12. Recital and event management
13. Costume tracking with size management
14. RFID check-in endpoint (POST /rfid/checkin)
15. Makeup class scheduling

**Defer until explicitly validated with Carollette:**
- Student skill/progress tracking (nice-to-have; not confirmed as a priority)
- Advanced admin reporting beyond 5-8 pre-built views

---

## Sources

- [Jackrabbit Dance Features](https://www.jackrabbitdance.com/features/)
- [Jackrabbit Dance: Tuition Management](https://www.jackrabbitdance.com/blog/dance-studio-tuition-management/)
- [Studio Pro: Top 10 Dance Studio Software Features](https://gostudiopro.com/blog/dance-studio-software-features)
- [Studio Pro: Recital Ticketing Solutions](https://gostudiopro.com/dance-recital-ticketing-solutions)
- [ClassJuggler Features](https://www.classjuggler.com/cj/pub/features.html)
- [Activity Messenger: 12 Studio Pro Alternatives](https://activitymessenger.com/blog/12-dance-studio-pro-alternatives-in-depth-comparison/)
- [Activity Messenger: Attendance Tracking for Dance Studios](https://activitymessenger.com/blog/attendance-tracking-for-dance-studios/)
- [Activity Messenger: Best Dance Studio Software](https://activitymessenger.com/blog/best-dance-studio-software/)
- [Gymdesk: Best Dance Studio Software Guide](https://gymdesk.com/blog/best-dance-software)
- [DanceDirector: Billing Software Guide](https://dancedirector.io/dance-studio-billing-software/)
- [Capterra / Software Advice: Jackrabbit Dance Reviews](https://www.softwareadvice.com/dance-studio/jackrabbit-profile/reviews/)
- [Mindbody: Top 5 Software for Small Dance Studios](https://www.mindbodyonline.com/business/education/comparison/top-5-software-options-small-dance-studios)
- [Akada: Costume Chaos / Recital Planning](https://akadasoftware.com/no-more-costume-chaos-how-to-simplify-recital-planning-for-your-dance-studio/)
- [Swyvel: Dance Studio Management Challenges](https://swyvel.io/blog/dance-studio-management-challenges/)
- [WellnessLiving: Why Studios Switch from Jackrabbit](https://www.wellnessliving.com/blog/find-out-why-jackrabbit-online-management-software-clients-are-switching-software/)
