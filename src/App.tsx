import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import Index from "./pages/Index";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ViewModeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/search-cnpj" element={<SearchCNPJ />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/affiliation" element={<AffiliationProgram />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/integrations/:id" element={<IntegrationSettings />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/upgrade" element={<Upgrade />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ViewModeProvider>
  </QueryClientProvider>
);

export default App;
