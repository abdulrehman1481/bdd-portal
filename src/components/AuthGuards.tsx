"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, UserMe, UserRole } from "@/lib/api";
import { clearSession, getStoredToken, setStoredRole } from "@/lib/session";

type RequireRoleProps = {
  roles: UserRole[];
  children: ReactNode;
};

type PublicOnlyProps = {
  children: ReactNode;
};

export function RequireRole({ roles, children }: RequireRoleProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      const token = getStoredToken();
      if (!token) {
        if (!cancelled) {
          setReady(true);
          setAllowed(false);
        }
        router.replace("/auth/signin");
        return;
      }

      try {
        const me: UserMe = await getMe(token);
        setStoredRole(me.role);

        if (!roles.includes(me.role)) {
          if (!cancelled) {
            setReady(true);
            setAllowed(false);
          }
          router.replace(me.role === "HOSPITAL" ? "/dashboard/hospital" : "/dashboard/donor");
          return;
        }

        if (!cancelled) {
          setAllowed(true);
          setReady(true);
        }
      } catch {
        clearSession();
        if (!cancelled) {
          setReady(true);
          setAllowed(false);
        }
        router.replace("/auth/signin");
      }
    }

    void verifySession();

    return () => {
      cancelled = true;
    };
  }, [roles, router]);

  if (!ready) {
    return <div className="notice">Checking secure session...</div>;
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}

export function PublicOnly({ children }: PublicOnlyProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verifyPublicRoute() {
      const token = getStoredToken();
      if (!token) {
        if (!cancelled) setReady(true);
        return;
      }

      try {
        const me: UserMe = await getMe(token);
        setStoredRole(me.role);
        router.replace(me.role === "HOSPITAL" ? "/dashboard/hospital" : "/dashboard/donor");
      } catch {
        clearSession();
        if (!cancelled) setReady(true);
      }
    }

    void verifyPublicRoute();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return <div className="notice">Checking session...</div>;
  }

  return <>{children}</>;
}
