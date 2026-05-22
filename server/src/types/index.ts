import { Type, Static } from 'typebox'
import type { User } from '@supabase/supabase-js'

// Augment FastifyRequest to carry the verified Supabase user + extracted claims.
// auth.ts populates these fields on every authenticated request.
declare module 'fastify' {
  interface FastifyRequest {
    user: User | undefined
    organizationId: string | undefined
    role: string | undefined
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
