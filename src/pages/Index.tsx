import { Suspense, lazy } from "react";

const ProfessionalAtlas = lazy(() => import("@/components/ProfessionalAtlas"));

const Index = () => {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background text-primary">טוען מודל...</div>}>
      <ProfessionalAtlas />
    </Suspense>
  );
};

export default Index;
