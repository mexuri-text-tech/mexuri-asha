import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import LoadingSplash from "./pages/LoadingSplash";
import Chat from "./pages/Chat";
import Surveys from "./pages/Surveys";
import SurveyDetail from "./pages/SurveyDetail";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import PublicSurvey from "./pages/PublicSurvey";
import Admin from "./pages/Admin";
import { TERMS_VERSION } from "./data/termsContent";
import TermsGate from "./components/TermGate";

function RequireAuth({ children }) {
  const { session } = useApp();
  if (!session) return <Navigate to="/login" replace />;
  if (!session.onboarded) return <Navigate to="/onboarding" replace />;
  if (!session.termsAcceptedAt || session.termsVersion !== TERMS_VERSION) {
    return <TermsGate />;
  }
  return children;
}

function RequireGuest({ children }) {
  const { session } = useApp();
  if (session?.onboarded) return <Navigate to="/chat" replace />;
  return children;
}

function Routed() {
  const { session, authLoading } = useApp();
  if (authLoading) return <div className="min-h-screen bg-base-950" />;

  return (
    <Routes>
      <Route path="/" element={<Navigate to={session ? "/chat" : "/login"} replace />} />
      <Route path="/s/:slug" element={<PublicSurvey />} />
      <Route
        path="/login"
        element={
          <RequireGuest>
            <Login />
          </RequireGuest>
        }
      />
      <Route
        path="/onboarding"
        element={
          session ? (
            session.onboarded ? <Navigate to="/chat" replace /> : <Onboarding />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="/loading" element={session ? <LoadingSplash /> : <Navigate to="/login" replace />} />

      <Route
        path="/chat"
        element={
          <RequireAuth>
            <Chat />
          </RequireAuth>
        }
      />
      <Route
        path="/chat/:chatId"
        element={
          <RequireAuth>
            <Chat />
          </RequireAuth>
        }
      />
      <Route
        path="/surveys"
        element={
          <RequireAuth>
            <Surveys />
          </RequireAuth>
        }
      />
      <Route
        path="/surveys/:surveyId"
        element={
          <RequireAuth>
            <SurveyDetail />
          </RequireAuth>
        }
      />
      <Route
        path="/analytics"
        element={
          <RequireAuth>
            <Analytics />
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <Settings />
          </RequireAuth>
        }
      />

      <Route path="/admin" element={<RequireAuth><Admin /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routed />
      </AppProvider>
    </BrowserRouter>
  );
}
