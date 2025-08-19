import { useEffect, useState } from "react";
import { useLocation } from "wouter";

interface SmartRouterProps {
  children: React.ReactNode;
}

export default function SmartRouter({ children }: SmartRouterProps) {
  // Remove all the redirect logic - let App.tsx handle routing
  return <>{children}</>;
}
