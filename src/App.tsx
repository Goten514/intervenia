import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlanProvider } from "@/contexts/PlanContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SharedIntervention from "./pages/SharedIntervention";
import StatusPage from "./pages/StatusPage";
import DomainHelp from "./pages/DomainHelp";
import PrivacyConsentBanner from "@/components/PrivacyConsentBanner";


const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlanProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/status" element={<StatusPage />} />
                <Route path="/aide-domaine" element={<DomainHelp />} />
                <Route path="/share/:id" element={<SharedIntervention />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <PrivacyConsentBanner />
            </BrowserRouter>
          </TooltipProvider>
        </PlanProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
