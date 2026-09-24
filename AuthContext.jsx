import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "../lib/supabase";
import { getMyProfile, getIsSuperAdmin, getMyMemberships, getDefaultBranch, getMyApplication } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [memberships, setMemberships] = useState([]);
  const [application, setApplication] = useState(null);
  const [currentBusinessId, setCurrentBusinessId] = useState(null);
  const [currentBranch, setCurrentBranch] = useState(null);

  const loadForUser = useCallback(async (user) => {
    const prof = await getMyProfile(user.id).catch(() => null);
    setProfile(prof);

    const superAdmin = await getIsSuperAdmin().catch(() => false);
    setIsSuperAdmin(Boolean(superAdmin));

    if (!superAdmin) {
      const rows = await getMyMemberships().catch(() => []);
      setMemberships(rows || []);
      if (rows && rows.length > 0) {
        const businessId = rows[0].business_id;
        setCurrentBusinessId(businessId);
        const branch = await getDefaultBranch(businessId).catch(() => null);
        setCurrentBranch(branch);
      } else {
        const app = await getMyApplication(user.id).catch(() => null);
        setApplication(app);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    setSession(data.session || null);
    if (data.session?.user) {
      await loadForUser(data.session.user);
    }
    setLoading(false);
  }, [loadForUser]);

  useEffect(() => {
    refresh();
    if (!supabaseConfigured) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess?.user) {
        setLoading(true);
        loadForUser(sess.user).finally(() => setLoading(false));
      } else {
        setProfile(null);
        setIsSuperAdmin(false);
        setMemberships([]);
        setApplication(null);
        setCurrentBusinessId(null);
        setCurrentBranch(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh, loadForUser]);

  const switchBusiness = useCallback(async (businessId) => {
    setCurrentBusinessId(businessId);
    const branch = await getDefaultBranch(businessId).catch(() => null);
    setCurrentBranch(branch);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const currentMembership = memberships.find((m) => m.business_id === currentBusinessId) || null;
  const role = currentMembership?.role || null;
  const permissions = currentMembership?.permissions || {};

  const hasModule = useCallback(
    (module) => {
      if (!role) return false;
      if (role === "owner") return true;
      if (role === "manager") return Boolean(permissions[module]);
      return false; // cashier
    },
    [role, permissions]
  );

  const value = {
    loading,
    session,
    user: session?.user || null,
    profile,
    isSuperAdmin,
    memberships,
    application,
    currentBusinessId,
    currentBusiness: currentMembership?.businesses || null,
    currentBranch,
    role,
    permissions,
    hasModule,
    switchBusiness,
    signOut,
    refresh
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
