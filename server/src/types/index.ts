import { Type, Static } from 'typebox'
import type { User } from '@supabase/supabase-js'

// Augment FastifyRequest to carry the verified Supabase user + extracted claims.
// auth.ts populates these fields on every authenticated request.
declare module 'fastify' {
  interface FastifyRequest {
    user: User | undefined
    organizationId: string | undefined
    role: string | undefined
    familyId: string | undefined
  }
}

// TypeBox schema for GET /health (open endpoint)
export const HealthResponse = Type.Object({
  status: Type.Literal('ok'),
  timestamp: Type.String(),
})
export type HealthResponse = Static<typeof HealthResponse>

// TypeBox schema for GET /health/authed (JWT-gated endpoint)
export const AuthedHealthResponse = Type.Object({
  status: Type.Literal('ok'),
  role: Type.Optional(Type.String()),
  organizationId: Type.Optional(Type.String()),
  timestamp: Type.String(),
})
export type AuthedHealthResponse = Static<typeof AuthedHealthResponse>

// TypeBox schema for GET /sessions/today — one entry per class_session today
export const SessionSummary = Type.Object({
  id: Type.String(),
  classId: Type.String(),
  className: Type.String(),
  instructorName: Type.Optional(Type.String()),
  startTime: Type.String(),         // "HH:MM" 24h from classes.start_time
  durationMinutes: Type.Number(),
  sessionDate: Type.String(),       // "YYYY-MM-DD"
  status: Type.Union([
    Type.Literal('scheduled'), Type.Literal('completed'), Type.Literal('cancelled'),
  ]),
  presentCount: Type.Number(),
  totalEnrolled: Type.Number(),
})
export type SessionSummary = Static<typeof SessionSummary>

// TypeBox schema for GET /sessions/:id/roster — one entry per enrolled student
export const RosterStudent = Type.Object({
  studentId: Type.String(),
  enrollmentId: Type.String(),
  firstName: Type.String(),
  lastName: Type.String(),
  attendanceId: Type.Optional(Type.String()),
  attendanceStatus: Type.Optional(Type.Union([
    Type.Literal('present'), Type.Literal('absent'),
    Type.Literal('late'), Type.Literal('excused'),
  ])),
})
export type RosterStudent = Static<typeof RosterStudent>

// TypeBox schemas for PATCH /attendance — mark a student present/absent/late/excused
export const AttendanceMarkBody = Type.Object({
  sessionId: Type.String(),
  studentId: Type.String(),
  status: Type.Union([
    Type.Literal('present'),
    Type.Literal('absent'),
    Type.Literal('late'),
    Type.Literal('excused'),
  ]),
})
export type AttendanceMarkBody = Static<typeof AttendanceMarkBody>

export const AttendanceMarkResponse = Type.Object({
  attendanceId: Type.Optional(Type.String()),
  status: Type.String(),
  message: Type.Optional(Type.String()),
})
export type AttendanceMarkResponse = Static<typeof AttendanceMarkResponse>

// TypeBox schemas for POST /sessions/:id/submit — mark session completed
export const SubmitResponse = Type.Object({
  sessionId: Type.String(),
  status: Type.Literal('completed'),
  submittedAt: Type.String(),
})
export type SubmitResponse = Static<typeof SubmitResponse>

// TypeBox schemas for POST /rfid/checkin — ATTN-08 stub (Phase 2 placeholder)
export const RfidCheckinBody = Type.Object({
  card_uid: Type.String(),
  device_id: Type.Optional(Type.String()),
})
export type RfidCheckinBody = Static<typeof RfidCheckinBody>

// TypeBox schemas for POST /auth/invite — admin-only staff invitation
export const InviteBody = Type.Object({
  email: Type.String(),
  role: Type.Union([
    Type.Literal('admin'),
    Type.Literal('instructor'),
    Type.Literal('front_desk'),
  ]),
})
export type InviteBody = Static<typeof InviteBody>

export const InviteResponse = Type.Object({
  message: Type.String(),
  email: Type.String(),
})
export type InviteResponse = Static<typeof InviteResponse>

// TypeBox schemas for class management (Plan 02-03)

export const CreateClassBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  type: Type.Optional(Type.Union([
    Type.Literal('recurring'),
    Type.Literal('drop_in'),
    Type.Literal('workshop'),
  ])),
  instructorId: Type.Optional(Type.String({ format: 'uuid' })),
  dayOfWeek: Type.Optional(Type.Number({ minimum: 0, maximum: 6 })),
  startTime: Type.String(),
  durationMinutes: Type.Number({ minimum: 1 }),
  room: Type.Optional(Type.String()),
  capacity: Type.Optional(Type.Number({ minimum: 1 })),
  ageMin: Type.Optional(Type.Number({ minimum: 0 })),
  ageMax: Type.Optional(Type.Number({ minimum: 0 })),
  level: Type.Optional(Type.String()),
})
export type CreateClassBody = Static<typeof CreateClassBody>

export const UpdateClassBody = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  type: Type.Optional(Type.Union([
    Type.Literal('recurring'),
    Type.Literal('drop_in'),
    Type.Literal('workshop'),
  ])),
  instructorId: Type.Optional(Type.String({ format: 'uuid' })),
  dayOfWeek: Type.Optional(Type.Number({ minimum: 0, maximum: 6 })),
  startTime: Type.Optional(Type.String()),
  durationMinutes: Type.Optional(Type.Number({ minimum: 1 })),
  room: Type.Optional(Type.String()),
  capacity: Type.Optional(Type.Number({ minimum: 1 })),
  ageMin: Type.Optional(Type.Number({ minimum: 0 })),
  ageMax: Type.Optional(Type.Number({ minimum: 0 })),
  level: Type.Optional(Type.String()),
  active: Type.Optional(Type.Boolean()),
})
export type UpdateClassBody = Static<typeof UpdateClassBody>

export const ClassListQuery = Type.Object({
  active: Type.Optional(Type.Boolean()),
})
export type ClassListQuery = Static<typeof ClassListQuery>

// ── Student CRUD schemas (Plan 02-02) ──────────────────────────────────

export const CreateStudentBody = Type.Object({
  familyId: Type.String({ format: 'uuid' }),
  firstName: Type.String({ minLength: 1 }),
  lastName: Type.String({ minLength: 1 }),
  dob: Type.Optional(Type.String({ format: 'date' })),
  photoUrl: Type.Optional(Type.String()),
  medicalNotes: Type.Optional(Type.String()),
  skillLevel: Type.Optional(Type.String()),
})
export type CreateStudentBody = Static<typeof CreateStudentBody>

export const UpdateStudentBody = Type.Object({
  familyId: Type.Optional(Type.String({ format: 'uuid' })),
  firstName: Type.Optional(Type.String({ minLength: 1 })),
  lastName: Type.Optional(Type.String({ minLength: 1 })),
  dob: Type.Optional(Type.String({ format: 'date' })),
  photoUrl: Type.Optional(Type.String()),
  medicalNotes: Type.Optional(Type.String()),
  skillLevel: Type.Optional(Type.String()),
  active: Type.Optional(Type.Boolean()),
})
export type UpdateStudentBody = Static<typeof UpdateStudentBody>

export const StudentListQuery = Type.Object({
  search: Type.Optional(Type.String()),
  classId: Type.Optional(Type.String({ format: 'uuid' })),
  active: Type.Optional(Type.Boolean()),
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 50, maximum: 100 })),
})
export type StudentListQuery = Static<typeof StudentListQuery>

// ── Family CRUD schemas (Plan 02-02) ───────────────────────────────────

export const CreateFamilyBody = Type.Object({
  primaryGuardianName: Type.String({ minLength: 1 }),
  email: Type.String(),
  phone: Type.Optional(Type.String()),
  secondaryGuardianName: Type.Optional(Type.String()),
  emergencyContactName: Type.Optional(Type.String()),
  emergencyContactPhone: Type.Optional(Type.String()),
  address: Type.Optional(Type.String()),
})
export type CreateFamilyBody = Static<typeof CreateFamilyBody>

export const UpdateFamilyBody = Type.Object({
  primaryGuardianName: Type.Optional(Type.String({ minLength: 1 })),
  email: Type.Optional(Type.String()),
  phone: Type.Optional(Type.String()),
  secondaryGuardianName: Type.Optional(Type.String()),
  emergencyContactName: Type.Optional(Type.String()),
  emergencyContactPhone: Type.Optional(Type.String()),
  address: Type.Optional(Type.String()),
})
export type UpdateFamilyBody = Static<typeof UpdateFamilyBody>

export const FamilyListQuery = Type.Object({
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 50, maximum: 100 })),
})
export type FamilyListQuery = Static<typeof FamilyListQuery>

// ── RFID Card schemas (Plan 02-02) ─────────────────────────────────────

export const CreateRfidCardBody = Type.Object({
  studentId: Type.String({ format: 'uuid' }),
  cardUid: Type.String({ minLength: 1 }),
})
export type CreateRfidCardBody = Static<typeof CreateRfidCardBody>

// ── Enrollment schemas (Plan 02-04) ───────────────────────────────────

export const EnrollBody = Type.Object({
  studentId: Type.String({ format: 'uuid' }),
  classId: Type.String({ format: 'uuid' }),
})
export type EnrollBody = Static<typeof EnrollBody>

export const TransferBody = Type.Object({
  studentId: Type.String({ format: 'uuid' }),
  fromClassId: Type.String({ format: 'uuid' }),
  toClassId: Type.String({ format: 'uuid' }),
})
export type TransferBody = Static<typeof TransferBody>

// ── Tuition Plan schemas (Plan 03-01) ────────────────────────────────

export const CreateTuitionPlanBody = Type.Object({
  classId: Type.Optional(Type.String({ format: 'uuid' })),
  amount: Type.Number({ minimum: 0 }),
  interval: Type.Union([
    Type.Literal('monthly'),
    Type.Literal('per_session'),
    Type.Literal('seasonal'),
  ]),
})
export type CreateTuitionPlanBody = Static<typeof CreateTuitionPlanBody>

export const UpdateTuitionPlanBody = Type.Object({
  classId: Type.Optional(Type.String({ format: 'uuid' })),
  amount: Type.Optional(Type.Number({ minimum: 0 })),
  interval: Type.Optional(Type.Union([
    Type.Literal('monthly'),
    Type.Literal('per_session'),
    Type.Literal('seasonal'),
  ])),
  active: Type.Optional(Type.Boolean()),
})
export type UpdateTuitionPlanBody = Static<typeof UpdateTuitionPlanBody>

// ── Discount schemas (Plan 03-01) ────────────────────────────────────

export const CreateDiscountBody = Type.Object({
  familyId: Type.Optional(Type.String({ format: 'uuid' })),
  classId: Type.Optional(Type.String({ format: 'uuid' })),
  type: Type.Union([
    Type.Literal('sibling'),
    Type.Literal('scholarship'),
    Type.Literal('staff'),
  ]),
  amount: Type.Optional(Type.Number({ minimum: 0 })),
  percent: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
})
export type CreateDiscountBody = Static<typeof CreateDiscountBody>

export const UpdateDiscountBody = Type.Object({
  familyId: Type.Optional(Type.String({ format: 'uuid' })),
  classId: Type.Optional(Type.String({ format: 'uuid' })),
  type: Type.Optional(Type.Union([
    Type.Literal('sibling'),
    Type.Literal('scholarship'),
    Type.Literal('staff'),
  ])),
  amount: Type.Optional(Type.Number({ minimum: 0 })),
  percent: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  active: Type.Optional(Type.Boolean()),
})
export type UpdateDiscountBody = Static<typeof UpdateDiscountBody>

// ── Invoice schemas (Plan 03-02) ─────────────────────────────────────

export const GenerateInvoiceBody = Type.Object({
  familyId: Type.String({ format: 'uuid' }),
})
export type GenerateInvoiceBody = Static<typeof GenerateInvoiceBody>

export const InvoiceListQuery = Type.Object({
  familyId: Type.Optional(Type.String({ format: 'uuid' })),
  status: Type.Optional(Type.Union([
    Type.Literal('pending'),
    Type.Literal('paid'),
    Type.Literal('overdue'),
    Type.Literal('waived'),
  ])),
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 25, maximum: 100 })),
})
export type InvoiceListQuery = Static<typeof InvoiceListQuery>

export const UpdateInvoiceBody = Type.Object({
  status: Type.Literal('waived'),
})
export type UpdateInvoiceBody = Static<typeof UpdateInvoiceBody>

// ── Payment schemas (Plan 03-02) ─────────────────────────────────────

export const RecordPaymentBody = Type.Object({
  invoiceId: Type.String({ format: 'uuid' }),
  amount: Type.Number({ minimum: 0.01 }),
  method: Type.Union([
    Type.Literal('cash'),
    Type.Literal('check'),
  ]),
  notes: Type.Optional(Type.String()),
})
export type RecordPaymentBody = Static<typeof RecordPaymentBody>

export const PaymentListQuery = Type.Object({
  invoiceId: Type.Optional(Type.String({ format: 'uuid' })),
  familyId: Type.Optional(Type.String({ format: 'uuid' })),
  page: Type.Optional(Type.Number({ default: 1 })),
  limit: Type.Optional(Type.Number({ default: 25, maximum: 100 })),
})
export type PaymentListQuery = Static<typeof PaymentListQuery>

// ── Subscription schemas (Plan 03-03) ────────────────────────────────

export const SubscribeBody = Type.Object({
  familyId: Type.String({ format: 'uuid' }),
})
export type SubscribeBody = Static<typeof SubscribeBody>

// ── Notification schemas (Plan 04-01) ──────────────────────────────

export const NotificationListQuery = Type.Object({
  channel: Type.Optional(Type.Union([
    Type.Literal('email'),
    Type.Literal('sms'),
  ])),
  limit: Type.Optional(Type.Number({ default: 25, maximum: 100 })),
  offset: Type.Optional(Type.Number({ default: 0 })),
})
export type NotificationListQuery = Static<typeof NotificationListQuery>

// ── Parent Portal schemas (Plan 04-03) ────────────────────────────────

export const InviteParentBody = Type.Object({
  familyId: Type.String({ format: 'uuid' }),
  email: Type.String(),
})
export type InviteParentBody = Static<typeof InviteParentBody>

export const UpdateParentProfileBody = Type.Object({
  primaryGuardianName: Type.Optional(Type.String({ minLength: 1 })),
  secondaryGuardianName: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  phone: Type.Optional(Type.String()),
  emergencyContactName: Type.Optional(Type.String()),
  emergencyContactPhone: Type.Optional(Type.String()),
  address: Type.Optional(Type.String()),
})
export type UpdateParentProfileBody = Static<typeof UpdateParentProfileBody>

export const ParentAttendanceQuery = Type.Object({
  studentId: Type.Optional(Type.String({ format: 'uuid' })),
  startDate: Type.Optional(Type.String({ format: 'date' })),
  endDate: Type.Optional(Type.String({ format: 'date' })),
})
export type ParentAttendanceQuery = Static<typeof ParentAttendanceQuery>
