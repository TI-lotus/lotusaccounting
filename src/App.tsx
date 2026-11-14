import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { DataProvider } from "@/contexts/DataContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UserProfileProvider } from "@/contexts/UserProfileContext";
import Auth from "./pages/Auth";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

const Index = lazy(() => import("./pages/Index"));
const Clients = lazy(() => import("./pages/Clients"));
const Payments = lazy(() => import("./pages/Payments"));
const Documents = lazy(() => import("./pages/Documents"));
const Reports = lazy(() => import("./pages/Reports"));
const Integrations = lazy(() => import("./pages/Integrations"));
const IntegrationSettings = lazy(() => import("./pages/IntegrationSettings"));
const Messages = lazy(() => import("./pages/Messages"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const OperationalTemplates = lazy(() => import("./pages/OperationalTemplates"));
const SearchCNPJ = lazy(() => import("./pages/SearchCNPJ"));
const AffiliationProgram = lazy(() => import("./pages/AffiliationProgram"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const Agents = lazy(() => import("./pages/Agents"));
const Tasks = lazy(() => import("./pages/Tasks"));
const WorkQueue = lazy(() => import("./pages/WorkQueue"));
const Periods = lazy(() => import("./pages/Periods"));
const Staff = lazy(() => import("./pages/Staff"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Finance = lazy(() => import("./pages/Finance"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Reconciliation = lazy(() => import("./pages/Reconciliation"));
const Lia = lazy(() => import("./pages/Lia"));
const Workflows = lazy(() => import("./pages/Workflows"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const RouteLoading = () => (
  <div className="flex min-h-[40vh] items-center justify-center bg-background text-sm text-muted-foreground" role="status" aria-live="polite">
    Carregando seção…
  </div>
);

const WorkspaceData = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return <UserProfileProvider key={user?.id ?? "anonymous"}><DataProvider>{children}</DataProvider></UserProfileProvider>;
};

const ProtectedRoute = ({
  children,
  allowClient = true,
  adminOnly = false,
}: {
  children: React.ReactNode;
  allowClient?: boolean;
  adminOnly?: boolean;
}) => {
  const { session, loading, mfaRequired, profile, profileError, signOut } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (mfaRequired) {
    return <Navigate to="/auth?mfa=1" replace />;
  }

  if (!profile || profile.status !== "active" || !profile.tenant_id) {
    return <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-semibold">Acesso indisponível</h1>
        <p className="text-muted-foreground">{profileError || (profile?.status !== "active" && profile ? "Seu acesso está desativado. Contate o administrador do escritório." : "Seu perfil ainda não está vinculado a um escritório.")}</p>
        <button className="rounded-md bg-secondary px-4 py-2 hover:brightness-110" onClick={() => void signOut()}>Voltar para o login</button>
      </div>
    </main>;
  }

  if (!allowClient && profile?.account_type === "client") {
    return <Navigate to="/" replace />;
  }

  if (adminOnly && profile.account_type !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
};

const protectedPage = (
  children: React.ReactNode,
  options?: { allowClient?: boolean; adminOnly?: boolean },
) => (
  <ProtectedRoute allowClient={options?.allowClient} adminOnly={options?.adminOnly}>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ViewModeProvider>
        <WorkspaceData>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppErrorBoundary>
                  <Suspense fallback={<RouteLoading />}>
                    <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/" element={protectedPage(<Index />)} />
                  <Route
                    path="/clients"
                    element={protectedPage(<Clients />, { allowClient: false })}
                  />
                  <Route
                    path="/clients/:id"
                    element={protectedPage(<ClientDetail />, {
                      allowClient: false,
                    })}
                  />
                  <Route
                    path="/payments"
                    element={protectedPage(<Payments />)}
                  />
                  <Route
                    path="/documents"
                    element={protectedPage(<Documents />)}
                  />
                  <Route path="/reports" element={protectedPage(<Reports />)} />
                  <Route
                    path="/search-cnpj"
                    element={protectedPage(<SearchCNPJ />, {
                      allowClient: false,
                    })}
                  />
                  <Route
                    path="/agents"
                    element={protectedPage(<Agents />, { allowClient: false })}
                  />
                  <Route
                    path="/affiliation"
                    element={protectedPage(<AffiliationProgram />, {
                      allowClient: false,
                    })}
                  />
                  <Route
                    path="/integrations"
                    element={protectedPage(<Integrations />, {
                      allowClient: false,
                    })}
                  />
                  <Route
                    path="/integrations/:id"
                    element={protectedPage(<IntegrationSettings />, {
                      allowClient: false,
                    })}
                  />
                  <Route
                    path="/messages"
                    element={protectedPage(<Messages />)}
                  />
                  <Route
                    path="/notifications"
                    element={protectedPage(<Notifications />)}
                  />
                  <Route
                    path="/settings"
                    element={protectedPage(<Settings />)}
                  />
                  <Route
                    path="/settings/templates"
                    element={protectedPage(<OperationalTemplates />, {
                      allowClient: false,
                    })}
                  />
                  <Route path="/upgrade" element={protectedPage(<Upgrade />, { adminOnly: true })} />
                  <Route path="/tasks" element={protectedPage(<Tasks />)} />
                  <Route
                    path="/work-queue"
                    element={protectedPage(<WorkQueue />, {
                      allowClient: false,
                    })}
                  />
                  <Route path="/periods" element={protectedPage(<Periods />)} />
                  <Route
                    path="/staff"
                    element={protectedPage(<Staff />, { allowClient: false })}
                  />
                  <Route path="/agenda" element={protectedPage(<Agenda />)} />
                  <Route
                    path="/finance"
                    element={protectedPage(<Finance />, { allowClient: false })}
                  />
                  <Route
                    path="/invoices"
                    element={protectedPage(<Invoices />)}
                  />
                  <Route
                    path="/reconciliation"
                    element={protectedPage(<Reconciliation />, {
                      allowClient: false,
                    })}
                  />
                  <Route
                    path="/lia"
                    element={protectedPage(<Lia />, { allowClient: false })}
                  />
                  <Route
                    path="/workflows"
                    element={protectedPage(<Workflows />, {
                      allowClient: false,
                    })}
                  />
                  <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </AppErrorBoundary>
              </BrowserRouter>
            </TooltipProvider>
        </WorkspaceData>
      </ViewModeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
