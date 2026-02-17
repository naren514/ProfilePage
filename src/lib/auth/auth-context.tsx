"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface AuthUser {
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      try {
        const res = await fetch("/api/auth/session", { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user || null);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Sign in failed");
    }

    setUser({ email: email.toLowerCase() });
  };

  const signOut = async () => {
    const res = await fetch("/api/auth/session", { method: "DELETE" });
    if (!res.ok) {
      throw new Error("Sign out failed");
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
