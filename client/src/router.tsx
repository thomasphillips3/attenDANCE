import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import FrontDeskLayout from './layouts/FrontDeskLayout'
import AdminLayout from './layouts/AdminLayout'
import ParentLayout from './layouts/ParentLayout'
import InstructorLayout from './layouts/InstructorLayout'
import { Login } from './screens/Login'
import { ClassList } from './screens/ClassList'

// Lazy-loaded admin screens -- each is a minimal placeholder until Plans 02-02/02-03/02-04
const StudentsPage = lazy(() => import('./screens/admin/StudentsPage'))
const StudentForm = lazy(() => import('./screens/admin/StudentForm'))
const FamiliesPage = lazy(() => import('./screens/admin/FamiliesPage'))
const FamilyForm = lazy(() => import('./screens/admin/FamilyForm'))
const ClassesPage = lazy(() => import('./screens/admin/ClassesPage'))
const ClassForm = lazy(() => import('./screens/admin/ClassForm'))
const ClassDetail = lazy(() => import('./screens/admin/ClassDetail'))
const BillingPage = lazy(() => import('./screens/admin/BillingPage'))
const TuitionPlanForm = lazy(() => import('./screens/admin/TuitionPlanForm'))
const InvoicesPage = lazy(() => import('./screens/admin/InvoicesPage'))
const FamilyBilling = lazy(() => import('./screens/admin/FamilyBilling'))
const NotificationsPage = lazy(() => import('./screens/admin/NotificationsPage'))
const DashboardPage = lazy(() => import('./screens/admin/DashboardPage'))
const ReportsPage = lazy(() => import('./screens/admin/ReportsPage'))

// Lazy-loaded front desk screen (Roster is heavier than ClassList)
const Roster = lazy(() => import('./screens/Roster'))

// Lazy-loaded instructor portal screens (Plan 05-03)
const InstructorDashboard = lazy(() => import('./screens/staff/InstructorDashboard'))
const InstructorSchedule = lazy(() => import('./screens/staff/InstructorSchedule'))
const InstructorHours = lazy(() => import('./screens/staff/InstructorHours'))

// Lazy-loaded parent portal screens (Plan 04-03)
const ParentLogin = lazy(() => import('./screens/parent/ParentLogin'))
const ParentDashboard = lazy(() => import('./screens/parent/ParentDashboard'))
const ParentClasses = lazy(() => import('./screens/parent/ParentClasses'))
const ParentAttendance = lazy(() => import('./screens/parent/ParentAttendance'))
const ParentProfile = lazy(() => import('./screens/parent/ParentProfile'))
const ParentInvoices = lazy(() => import('./screens/parent/ParentInvoices'))

/**
 * LazyPage -- Suspense wrapper with a loading spinner for lazy-loaded routes.
 * Same spinner style used across the app (cream background, purple border).
 */
function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              border: '3px solid var(--color-purple-tint-strong)',
              borderTopColor: 'var(--color-purple)',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.7s linear infinite',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

/**
 * Route tree:
 *
 * /login              -> Login (no layout)
 * /                   -> FrontDeskLayout (auth-gated)
 *   index             -> ClassList
 *   roster/:sessionId -> Roster (lazy)
 * /admin              -> AdminLayout (auth + admin role gated)
 *   index             -> Navigate to "dashboard"
 *   dashboard         -> DashboardPage (lazy)
 *   students          -> StudentsPage (lazy placeholder)
 *   students/new      -> StudentForm (lazy placeholder)
 *   students/:id      -> StudentForm (lazy placeholder)
 *   families          -> FamiliesPage (lazy placeholder)
 *   families/new      -> FamilyForm (lazy placeholder)
 *   families/:id      -> FamilyForm (lazy placeholder)
 *   families/:id/billing -> FamilyBilling (lazy, billing detail)
 *   classes           -> ClassesPage (lazy placeholder)
 *   classes/new       -> ClassForm (lazy placeholder)
 *   classes/:id       -> ClassDetail (lazy placeholder)
 *   billing           -> BillingPage (lazy)
 *   billing/invoices  -> InvoicesPage (lazy)
 *   billing/plans/new -> TuitionPlanForm (lazy)
 *   billing/plans/:id -> TuitionPlanForm (lazy, edit mode)
 *   communications    -> NotificationsPage (lazy)
 *   reports           -> ReportsPage (lazy, enrollment/revenue/attendance tabs)
 * /parent/login       -> ParentLogin (no layout, magic link)
 * /parent             -> ParentLayout (auth + parent role gated)
 *   index             -> ParentDashboard (lazy)
 *   classes           -> ParentClasses (lazy)
 *   attendance        -> ParentAttendance (lazy)
 *   invoices          -> ParentInvoices (lazy, Stripe Elements payment)
 *   profile           -> ParentProfile (lazy)
 * /instructor          -> InstructorLayout (auth + instructor role gated)
 *   index             -> InstructorDashboard (lazy, today's classes)
 *   schedule          -> InstructorSchedule (lazy, weekly view)
 *   hours             -> InstructorHours (lazy, hour logging + history)
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <FrontDeskLayout />,
    children: [
      { index: true, element: <ClassList /> },
      {
        path: 'roster/:sessionId',
        element: (
          <LazyPage>
            <Roster />
          </LazyPage>
        ),
      },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <LazyPage>
            <DashboardPage />
          </LazyPage>
        ),
      },
      {
        path: 'students',
        element: (
          <LazyPage>
            <StudentsPage />
          </LazyPage>
        ),
      },
      {
        path: 'students/new',
        element: (
          <LazyPage>
            <StudentForm />
          </LazyPage>
        ),
      },
      {
        path: 'students/:id',
        element: (
          <LazyPage>
            <StudentForm />
          </LazyPage>
        ),
      },
      {
        path: 'families',
        element: (
          <LazyPage>
            <FamiliesPage />
          </LazyPage>
        ),
      },
      {
        path: 'families/new',
        element: (
          <LazyPage>
            <FamilyForm />
          </LazyPage>
        ),
      },
      {
        path: 'families/:id',
        element: (
          <LazyPage>
            <FamilyForm />
          </LazyPage>
        ),
      },
      {
        path: 'families/:id/billing',
        element: (
          <LazyPage>
            <FamilyBilling />
          </LazyPage>
        ),
      },
      {
        path: 'classes',
        element: (
          <LazyPage>
            <ClassesPage />
          </LazyPage>
        ),
      },
      {
        path: 'classes/new',
        element: (
          <LazyPage>
            <ClassForm />
          </LazyPage>
        ),
      },
      {
        path: 'classes/:id',
        element: (
          <LazyPage>
            <ClassDetail />
          </LazyPage>
        ),
      },
      {
        path: 'classes/:id/edit',
        element: (
          <LazyPage>
            <ClassForm />
          </LazyPage>
        ),
      },
      {
        path: 'billing',
        element: (
          <LazyPage>
            <BillingPage />
          </LazyPage>
        ),
      },
      {
        path: 'billing/invoices',
        element: (
          <LazyPage>
            <InvoicesPage />
          </LazyPage>
        ),
      },
      {
        path: 'billing/plans/new',
        element: (
          <LazyPage>
            <TuitionPlanForm />
          </LazyPage>
        ),
      },
      {
        path: 'billing/plans/:id',
        element: (
          <LazyPage>
            <TuitionPlanForm />
          </LazyPage>
        ),
      },
      {
        path: 'communications',
        element: (
          <LazyPage>
            <NotificationsPage />
          </LazyPage>
        ),
      },
      {
        path: 'reports',
        element: (
          <LazyPage>
            <ReportsPage />
          </LazyPage>
        ),
      },
    ],
  },
  {
    path: '/parent/login',
    element: (
      <LazyPage>
        <ParentLogin />
      </LazyPage>
    ),
  },
  {
    path: '/parent',
    element: <ParentLayout />,
    children: [
      {
        index: true,
        element: (
          <LazyPage>
            <ParentDashboard />
          </LazyPage>
        ),
      },
      {
        path: 'classes',
        element: (
          <LazyPage>
            <ParentClasses />
          </LazyPage>
        ),
      },
      {
        path: 'attendance',
        element: (
          <LazyPage>
            <ParentAttendance />
          </LazyPage>
        ),
      },
      {
        path: 'invoices',
        element: (
          <LazyPage>
            <ParentInvoices />
          </LazyPage>
        ),
      },
      {
        path: 'profile',
        element: (
          <LazyPage>
            <ParentProfile />
          </LazyPage>
        ),
      },
    ],
  },
  {
    path: '/instructor',
    element: <InstructorLayout />,
    children: [
      {
        index: true,
        element: (
          <LazyPage>
            <InstructorDashboard />
          </LazyPage>
        ),
      },
      {
        path: 'schedule',
        element: (
          <LazyPage>
            <InstructorSchedule />
          </LazyPage>
        ),
      },
      {
        path: 'hours',
        element: (
          <LazyPage>
            <InstructorHours />
          </LazyPage>
        ),
      },
    ],
  },
])
