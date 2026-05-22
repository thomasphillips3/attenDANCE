import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import { useStore } from './store'
import { Login } from './screens/Login'
import { ClassList } from './screens/ClassList'
import { Roster } from './screens/Roster'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

/**
 * AppContent — session-gated view switcher.
 *
 * Auth states:
 * - loading: full-screen spinner (auth.getSession() not yet resolved)
 * - no session: Login screen
 * - session active: ClassList screen
 */
function AppContent() {
  const { session, loading } = useAuth()
  const { selectedSessionId, setSelectedSessionId } = useStore()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-cream)',
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
    )
  }

  if (!session) {
    return <Login />
  }

  if (selectedSessionId !== null) {
    return (
      <Roster
        sessionId={selectedSessionId}
        onBack={() => setSelectedSessionId(null)}
      />
    )
  }

  return <ClassList />
}

/**
 * App — root component.
 *
 * Wraps everything in QueryClientProvider so all screens can use
 * useQuery / useMutation from @tanstack/react-query.
 */
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
