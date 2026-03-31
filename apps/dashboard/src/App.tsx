import { useEffect, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { AppShell } from "./components/AppShell";
import { AuthPage } from "./pages/AuthPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { CustomerDashboardPage } from "./pages/CustomerDashboardPage";
import { CustomerVenuesPage } from "./pages/CustomerVenuesPage";
import { LandingPage } from "./pages/LandingPage";
import { MerchantDashboardPage } from "./pages/MerchantDashboardPage";
import { MerchantGeofencesPage } from "./pages/MerchantGeofencesPage";
import { MerchantLiveSessionsPage } from "./pages/MerchantLiveSessionsPage";
import { MerchantPricingPage } from "./pages/MerchantPricingPage";
import { MerchantSettlementsPage } from "./pages/MerchantSettlementsPage";
import { MerchantTaxAssistantPage } from "./pages/MerchantTaxAssistantPage";
import { MerchantVenuesPage } from "./pages/MerchantVenuesPage";
import { OperatorAnalyticsPage } from "./pages/OperatorAnalyticsPage";
import { OperatorDashboardPage } from "./pages/OperatorDashboardPage";
import { OperatorMerchantsPage } from "./pages/OperatorMerchantsPage";
import { OperatorSettlementsPage } from "./pages/OperatorSettlementsPage";
import { AnimatePresence } from "framer-motion";
import { clearAuth, getAppPathForRole, selectAuth, syncAuthSession, type UserRole } from "./store/authSlice";
import { useAppDispatch, useAppSelector } from "./store";

const RoleGate = ({ allowed, children }: {
  allowed: UserRole[];
  children: ReactElement;
}) => {
  const location = useLocation();
  const { isReady, role } = useAppSelector(selectAuth);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-obsidian text-slate-400">
        Loading your dashboard...
      </div>
    );
  }

  if (!role) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (!allowed.includes(role)) {
    return <Navigate to={getAppPathForRole(role)} replace />;
  }

  return children;
};

export const App = () => {
  const dispatch = useAppDispatch();
  const { isReady, role } = useAppSelector(selectAuth);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    void dispatch(syncAuthSession());

    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        dispatch(clearAuth());
        return;
      }

      void dispatch(syncAuthSession({ session }));
    });

    return () => {
      subscription.data.subscription.unsubscribe();
    };
  }, [dispatch]);

  useEffect(() => {
    if (!isReady || !role) {
      return;
    }

    if (location.pathname === "/" || location.pathname === "/auth" || location.pathname === "/auth/callback") {
      navigate(getAppPathForRole(role), { replace: true });
    }
  }, [isReady, location.pathname, navigate, role]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route
          path="/app/customer"
          element={
            <RoleGate allowed={["user"]}>
              <AppShell>
                <CustomerDashboardPage />
              </AppShell>
            </RoleGate>
          }
        />
        <Route
          path="/app/customer/venues"
          element={
            <RoleGate allowed={["user"]}>
              <AppShell>
                <CustomerVenuesPage />
              </AppShell>
            </RoleGate>
          }
        />
        <Route
          path="/app/merchant"
          element={
            <RoleGate allowed={["merchant"]}>
              <AppShell>
                <MerchantDashboardPage />
              </AppShell>
            </RoleGate>
          }
        />
        <Route
          path="/app/merchant/venues"
          element={
            <RoleGate allowed={["merchant"]}>
              <AppShell>
                <MerchantVenuesPage />
              </AppShell>
            </RoleGate>
          }
        />
        <Route
          path="/app/merchant/geofences"
          element={
            <RoleGate allowed={["merchant"]}>
              <AppShell>
                <MerchantGeofencesPage />
              </AppShell>
            </RoleGate>
          }
        />
        <Route
          path="/app/merchant/settlements"
          element={
            <RoleGate allowed={["merchant"]}>
              <AppShell>
                <MerchantSettlementsPage />
              </AppShell>
            </RoleGate>
          }
        />
        <Route
          path="/app/merchant/tax"
          element={
            <RoleGate allowed={["merchant"]}>
              <AppShell>
                <MerchantTaxAssistantPage />
              </AppShell>
            </RoleGate>
          }
        />
        <Route
          path="/app/operator"
          element={
            <RoleGate allowed={["admin"]}>
              <AppShell>
                <OperatorDashboardPage />
              </AppShell>
            </RoleGate>
          }
        />
        <Route
          path="/app/operator/merchants"
          element={
            <RoleGate allowed={["admin"]}>
              <AppShell>
                <OperatorMerchantsPage />
              </AppShell>
            </RoleGate>
          }
        />
        <Route
          path="/app/operator/settlements"
          element={
            <RoleGate allowed={["admin"]}>
              <AppShell>
                <OperatorSettlementsPage />
              </AppShell>
            </RoleGate>
          }
        />
        <Route
          path="/app/merchant/sessions"
          element={
            <RoleGate allowed={["merchant"]}>
              <AppShell>
                <MerchantLiveSessionsPage />
              </AppShell>
            </RoleGate>
          }
        />
        <Route
          path="/app/merchant/pricing"
          element={
            <RoleGate allowed={["merchant"]}>
              <AppShell>
                <MerchantPricingPage />
              </AppShell>
            </RoleGate>
          }
        />
        <Route
          path="/app/operator/analytics"
          element={
            <RoleGate allowed={["admin"]}>
              <AppShell>
                <OperatorAnalyticsPage />
              </AppShell>
            </RoleGate>
          }
        />
      </Routes>
    </AnimatePresence>
  );
};
