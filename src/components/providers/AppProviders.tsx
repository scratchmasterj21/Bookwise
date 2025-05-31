"use client";

import { AuthProvider } from "@/hooks/useAuth";
import React from "react";

interface AppProvidersProps {
  children: React.ReactNode;
}

const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return <AuthProvider>{children}</AuthProvider>;
};

export default AppProviders;
