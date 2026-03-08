import { Suspense, lazy } from "react";

const ModelViewer = lazy(() => import("@/components/ModelViewer"));

const Index = () => {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background text-primary">טוען מודל...</div>}>
      <ModelViewer />
    </Suspense>
  );
};

export default Index;
