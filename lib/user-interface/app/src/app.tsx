import { useContext } from "react";
import {
  BrowserRouter,
  HashRouter,
  Outlet,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import { AppContext } from "./common/app-context";
import { AdminProvider } from "./common/admin-context"
import GlobalHeader from "./components/global-header";
import Playground from "./pages/chatbot/playground/playground";
import DataPage from "./pages/admin/data-view-page";
import UserFeedbackPage from "./pages/admin/user-feedback-page";
import SessionPage from "./pages/chatbot/sessions/sessions"
import AllSessionsPage from "./pages/admin/all-sessions-page";
import MetricsPage from "./pages/admin/metrics-page";
import LlmEvaluationPage from "./pages/admin/llm-evaluation-page";
import DetailedEvaluationPage from "./pages/admin/detailed-evaluation-page";
import { v4 as uuidv4 } from "uuid";
import "./styles/app.scss";

function App() {
  const appContext = useContext(AppContext);
  const Router = BrowserRouter;

  return (
    <div style={{ height: "100%" }}>
      <AdminProvider> {/* Wrap your Router with AdminProvider */}
        <Router>
          <GlobalHeader />
          <div style={{ height: "56px", backgroundColor: "#0C2639" }}>&nbsp;</div>
          <div>
            <Routes>
              <Route
                index
                path="/"
                element={<Navigate to={`/chatbot/playground/${uuidv4()}`} replace />}
              />
              <Route path="/chatbot" element={<Outlet />}>
                <Route path="playground/:sessionId" element={<Playground />} />
                <Route path="sessions" element={<SessionPage />} />
              </Route>
              <Route path="/admin" element={<Outlet />}>
                <Route path="data" element={<DataPage />} />
                <Route path="user-feedback" element={<UserFeedbackPage />} />
                <Route path="all-sessions" element={<AllSessionsPage />} />
                <Route path="metrics" element={<MetricsPage />} />
                <Route path="llm-evaluation" element={<Outlet />}>
                  <Route index element={<LlmEvaluationPage />} />
                  {/* Support both URL formats for backward compatibility */}
                  <Route
                    path=":evaluationId"
                    element={
                      <DetailedEvaluationPage
                        documentType="detailedEvaluation" 
                      />
                    }
                  />
                  <Route
                    path="details/:evaluationId"
                    element={
                      <DetailedEvaluationPage
                        documentType="detailedEvaluation" 
                      />
                    }
                  />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to={`/chatbot/playground/${uuidv4()}`} replace />} />
            </Routes>
          </div>
        </Router>
      </AdminProvider>
    </div>
  );
}

export default App;
