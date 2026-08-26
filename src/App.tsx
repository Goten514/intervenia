import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlanProvider } from "@/contexts/PlanContext";
import { ServiceHealthProvider } from "@/contexts/ServiceHealthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import SharedIntervention from "./pages/SharedIntervention";
import StatusPage from "./pages/StatusPage";
import DomainHelp from "./pages/DomainHelp";
import DomainWarningBanner from "@/components/DomainWarningBanner";


const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="light">
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlanProvider>
          <ServiceHealthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <DomainWarningBanner />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/status" element={<StatusPage />} />
                  <Route path="/aide-domaine" element={<DomainHelp />} />

                  <Route path="/share/:id" element={<SharedIntervention />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </ServiceHealthProvider>
        </PlanProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
