import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import FrontDeskLayout from './layouts/FrontDeskLayout'
import AdminLayout from './layouts/AdminLayout'
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

// Lazy-loaded front desk screen (Roster is heavier than ClassList)
const Roster = lazy(() => import('./screens/Roster'))

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
 *   index             -> Navigate to "students"
 *   students          -> StudentsPage (lazy placeholder)
 *   students/new      -> StudentForm (lazy placeholder)
 *   students/:id      -> StudentForm (lazy placeholder)
 *   families          -> FamiliesPage (lazy placeholder)
 *   families/new      -> FamilyForm (lazy placeholder)
 *   families/:id      -> FamilyForm (lazy placeholder)
 *   classes           -> ClassesPage (lazy placeholder)
 *   classes/new       -> ClassForm (lazy placeholder)
 *   classes/:id       -> ClassDetail (lazy placeholder)
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
      { index: true, element: <Navigate to="students" replace /> },
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
    ],
  },
])
