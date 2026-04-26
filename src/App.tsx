import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { DataProvider } from "@/contexts/DataContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Clients from "./pages/Clients";
import Payments from "./pages/Payments";
import Documents from "./pages/Documents";
import Reports from "./pages/Reports";
import Integrations from "./pages/Integrations";
import IntegrationSettings from "./pages/IntegrationSettings";
import Messages from "./pages/Messages";
import Settings from "./pages/Settings";
import SearchCNPJ from "./pages/SearchCNPJ";
import AffiliationProgram from "./pages/AffiliationProgram";
import Upgrade from "./pages/Upgrade";
import Agents from "./pages/Agents";
import Tasks from "./pages/Tasks";
import Staff from "./pages/Staff";
import ClientDetail from "./pages/ClientDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return children;
};

const protectedPage = (children: React.ReactNode) => <ProtectedRoute>{children}</ProtectedRoute>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ViewModeProvider>
        <DataProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={protectedPage(<Index />)} />
              <Route path="/clients" element={protectedPage(<Clients />)} />
              <Route path="/clients/:id" element={protectedPage(<ClientDetail />)} />
              <Route path="/payments" element={protectedPage(<Payments />)} />
              <Route path="/documents" element={protectedPage(<Documents />)} />
              <Route path="/reports" element={protectedPage(<Reports />)} />
              <Route path="/search-cnpj" element={protectedPage(<SearchCNPJ />)} />
              <Route path="/agents" element={protectedPage(<Agents />)} />
              <Route path="/affiliation" element={protectedPage(<AffiliationProgram />)} />
              <Route path="/integrations" element={protectedPage(<Integrations />)} />
              <Route path="/integrations/:id" element={protectedPage(<IntegrationSettings />)} />
              <Route path="/messages" element={protectedPage(<Messages />)} />
              <Route path="/settings" element={protectedPage(<Settings />)} />
              <Route path="/upgrade" element={protectedPage(<Upgrade />)} />
              <Route path="/tasks" element={protectedPage(<Tasks />)} />
              <Route path="/staff" element={protectedPage(<Staff />)} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
        </DataProvider>
      </ViewModeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
