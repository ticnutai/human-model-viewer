import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AppNavigationSidebar, { useNavigationPinned } from "@/components/AppNavigationSidebar";
import { AppThemeProvider } from "@/contexts/AppThemeContext";
import { DesignModeProvider } from "@/components/design-mode/DesignModeProvider";
import DesignModeOverlay from "@/components/design-mode/DesignModeOverlay";
import DesignCloudSync from "@/components/design-mode/DesignCloudSync";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LegacyModelViewer = lazy(() => import("./components/ModelViewer"));
const BodyBuilder = lazy(() => import("./components/BodyBuilder"));
const MedicalMediaLab = lazy(() => import("./components/MedicalMediaLab"));

const queryClient = new QueryClient();

const RouteLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const AppRoutes = () => {
  const location = useLocation();
  const pinned = useNavigationPinned();
  const hasNavigation = location.pathname !== "/auth";
  return <div className={hasNavigation && pinned ? "app-nav-shell is-nav-pinned" : "app-nav-shell"}>
    {hasNavigation && <AppNavigationSidebar />}
    <div className="app-nav-content"><Routes>
      <Route path="/auth" element={<Auth />} /><Route path="/" element={<Index />} />
      <Route path="/advanced" element={<Navigate to="/legacy?panel=models&tool=models&effects=1" replace />} /><Route path="/legacy" element={<LegacyModelViewer />} />
      <Route path="/body-builder" element={<BodyBuilder />} /><Route path="/media-lab" element={<MedicalMediaLab />} /><Route path="*" element={<NotFound />} />
    </Routes></div>
  </div>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider><TooltipProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider><AppThemeProvider><DesignModeProvider>
            <Toaster />
            <Sonner />
            <DesignCloudSync />
            <DesignModeOverlay />
            <Suspense fallback={<RouteLoader />}>
              <AppRoutes />
            </Suspense>
        </DesignModeProvider></AppThemeProvider></AuthProvider>
      </BrowserRouter>
    </TooltipProvider></LanguageProvider>
  </QueryClientProvider>
);

export default App;
