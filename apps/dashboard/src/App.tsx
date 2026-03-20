import { useEffect, useState, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { AppShell } from "./components/AppShell";
import { AuthPage } from "./pages/AuthPage";
import { CustomerDashboardPage } from "./pages/CustomerDashboardPage";
import { CustomerVenuesPage } from "./pages/CustomerVenuesPage";
import { LandingPage } from "./pages/LandingPage";
import { MerchantDashboardPage } from "./pages/MerchantDashboardPage";
import { MerchantSettlementsPage } from "./pages/MerchantSettlementsPage";
import { MerchantTaxAssistantPage } from "./pages/MerchantTaxAssistantPage";
import { MerchantVenuesPage } from "./pages/MerchantVenuesPage";
import { OperatorDashboardPage } from "./pages/OperatorDashboardPage";
import { OperatorMerchantsPage } from "./pages/OperatorMerchantsPage";
import { OperatorSettlementsPage } from "./pages/OperatorSettlementsPage";

type UserRole = "user" | "merchant" | "admin";

const RoleGate = ({
  allowed,
  role,
  children
}: {
  allowed: UserRole[];
  role: UserRole | null;
  children: ReactElement;
}) => {
  const location = useLocation();

  if (!role) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (!allowed.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export const App = () => {
  const [role, setRole] = useState<UserRole | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadRole = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;

      if (!userId) {
        setRole(null);
        return;
      }

      const profile = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
      const nextRole = (profile.data?.role ?? "user") as UserRole;
      setRole(nextRole);
    };

    void loadRole();

    const subscription = supabase.auth.onAuthStateChange(async (_event, session) => {
      const userId = session?.user.id;

      if (!userId) {
        setRole(null);
        navigate("/");
        return;
      }

      const profile = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
      const nextRole = (profile.data?.role ?? "user") as UserRole;
      setRole(nextRole);
      navigate(nextRole === "merchant" ? "/app/merchant" : nextRole === "admin" ? "/app/operator" : "/app/customer");
    });

    return () => {
      subscription.data.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<LandingPage role={role} />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/app/customer"
        element={
          <RoleGate allowed={["user"]} role={role}>
            <AppShell role={role}>
              <CustomerDashboardPage />
            </AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/app/customer/venues"
        element={
          <RoleGate allowed={["user"]} role={role}>
            <AppShell role={role}>
              <CustomerVenuesPage />
            </AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/app/merchant"
        element={
          <RoleGate allowed={["merchant"]} role={role}>
            <AppShell role={role}>
              <MerchantDashboardPage />
            </AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/app/merchant/venues"
        element={
          <RoleGate allowed={["merchant"]} role={role}>
            <AppShell role={role}>
              <MerchantVenuesPage />
            </AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/app/merchant/settlements"
        element={
          <RoleGate allowed={["merchant"]} role={role}>
            <AppShell role={role}>
              <MerchantSettlementsPage />
            </AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/app/merchant/tax"
        element={
          <RoleGate allowed={["merchant"]} role={role}>
            <AppShell role={role}>
              <MerchantTaxAssistantPage />
            </AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/app/operator"
        element={
          <RoleGate allowed={["admin"]} role={role}>
            <AppShell role={role}>
              <OperatorDashboardPage />
            </AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/app/operator/merchants"
        element={
          <RoleGate allowed={["admin"]} role={role}>
            <AppShell role={role}>
              <OperatorMerchantsPage />
            </AppShell>
          </RoleGate>
        }
      />
      <Route
        path="/app/operator/settlements"
        element={
          <RoleGate allowed={["admin"]} role={role}>
            <AppShell role={role}>
              <OperatorSettlementsPage />
            </AppShell>
          </RoleGate>
        }
      />
    </Routes>
  );
};
