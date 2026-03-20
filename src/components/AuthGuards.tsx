"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/lib/api";
import { getStoredRole, getStoredToken } from "@/lib/session";

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
    const token = getStoredToken();
    const role = getStoredRole() as UserRole;

    if (!token) {
      router.replace("/auth/signin");
      return;
    }

    if (!roles.includes(role)) {
      router.replace(role === "HOSPITAL" ? "/dashboard/hospital" : "/dashboard/donor");
      return;
    }

    setAllowed(true);
    setReady(true);
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
    const token = getStoredToken();
    const role = getStoredRole() as UserRole;

    if (token) {
      router.replace(role === "HOSPITAL" ? "/dashboard/hospital" : "/dashboard/donor");
      return;
    }

    setReady(true);
  }, [router]);

  if (!ready) {
    return <div className="notice">Checking session...</div>;
  }

  return <>{children}</>;
}
