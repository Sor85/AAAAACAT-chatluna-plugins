import { createRoot, type Root } from "react-dom/client";
import React from "react";
import { AffinityDashboard } from "./AffinityDashboard";

export function mountAffinityDashboard(element: Element): () => void {
  const root: Root = createRoot(element);
  root.render(<AffinityDashboard />);
  return () => root.unmount();
}
