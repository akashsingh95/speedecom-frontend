import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { MarketplaceProvider } from './contexts/MarketplaceContext';
import { TourProvider } from './tour/TourProvider';
import ProtectedRoute from './ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import AdminApprovals from './pages/AdminApprovals';
import Uploads from './pages/Uploads';
import UploadDetails from './pages/UploadDetails';
import SuperAdminTenants from './pages/SuperAdminTenants';
import UserManagement from './pages/UserManagement';
import MarketplaceSettings from './pages/MarketplaceSettings';
import Subscription from './pages/Subscription';
import ProfileSettings from './pages/ProfileSettings';
import CostSheet from './pages/CostSheet';
import PaymentsCalculations from './pages/PaymentsCalculations';
import MasterSkuCalculations from './pages/MasterSkuCalculations';
import PaymentsSettlements from './pages/PaymentsSettlements';
import MarketplacePaymentDetails from './pages/MarketplacePaymentDetails';
import Downloads from './pages/Downloads';
import ScanReturns from './pages/ScanReturns';
import SpeedyAgentPage from './pages/SpeedyAgentPage';
import SuperAdminPricing from './pages/SuperAdminPricing';
import SBMRMManagement from './pages/SBMRMManagement';
import RMTenantList from './pages/RMTenantList';
import SupportPortal from './pages/SupportPortal';
import AdminSupport from './pages/AdminSupport';
import AdminInvoiceList from './pages/AdminInvoiceList';
import SuperAdminPayments from './pages/SuperAdminPayments';
import { hasStartedCampaign } from './components/listingStudio/lastCampaign';
import ListingStudioShell from './components/listingStudio/ListingStudioShell';
import ListingStudioHomePage from './pages/listingStudio/HomePage';
import ListingStudioProjectsPage from './pages/listingStudio/ProjectsPage';
import ListingStudioBrandkitsPage from './pages/listingStudio/BrandkitsPage';
import ListingStudioMyProductsPage from './pages/listingStudio/MyProductsPage';
import ListingStudioNewCampaignPage from './pages/listingStudio/NewCampaignPage';
import ListingStudioProjectLayout from './pages/listingStudio/project/ProjectLayout';
import ListingStudioProcessingPage from './pages/listingStudio/project/ProcessingPage';
import ListingStudioResearchPage from './pages/listingStudio/project/ResearchPage';
import ListingStudioStrategyPage from './pages/listingStudio/project/StrategyPage';
import ListingStudioAplusPage from './pages/listingStudio/project/AplusPage';
import ListingStudioPremiumAplusPage from './pages/listingStudio/project/PremiumAplusPage';
import ListingStudioListingPage from './pages/listingStudio/project/ListingPage';
import ListingStudioPublicPreviewPage from './pages/listingStudio/PublicPreviewPage';
import ListingStudioImagesPage from './pages/listingStudio/project/ImagesPage';
import ListingStudioComparisonShelfPage from './pages/listingStudio/project/ComparisonShelfPage';
import ListingStudioAlexaReadinessPage from './pages/listingStudio/project/AlexaReadinessPage';
import { ComingSoonPage } from './pages/listingStudio/project/ComingSoonPage';
import { Video, Boxes } from 'lucide-react';

import { Toaster } from 'sonner';

// Returns the correct landing page for admin-side roles (permission-aware for SBM)
const getAdminLandingPage = (role, permissions) => {
  switch (role) {
    case 'SuperAdmin': return '/admin/approvals';
    case 'SBM': {
      // Pick the first page the SBM actually has permission for
      if (permissions?.approveTenants || permissions?.approveSubscriptions || permissions?.rejectRegistrations) return '/admin/approvals';
      if (permissions?.viewTenants) return '/admin/tenants';
      if (permissions?.viewPricing) return '/admin/pricing';
      if (permissions?.manageRM) return '/admin/roles';
      if (permissions?.manageInvoices) return '/admin/invoices';
      if (permissions?.viewSupport !== false) return '/admin/support';
      // Fallback — show profile if no permissions at all
      return '/profile';
    }
    case 'RM': return '/rm/tenants';
    default: return null;
  }
};

// Permission guard for SBM admin pages — redirects if SBM lacks required permission
// requiredPermission can be a string or an array (any-of match)
const SBMPermissionGuard = ({ requiredPermission, children }) => {
  const { user } = useAuth();
  // SuperAdmin bypasses all checks
  if (user?.role === 'SuperAdmin') return children;
  // Non-SBM roles shouldn't reach admin pages (handled by TenantOnly), just render
  if (user?.role !== 'SBM') return children;
  // Check if SBM has the required permission(s)
  // Permissions added after initial records were created default to true when absent (undefined)
  const defaultTruePerms = new Set(['viewSupport']);
  const perms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  const hasPermission = perms.some(p =>
    defaultTruePerms.has(p) ? user?.permissions?.[p] !== false : !!user?.permissions?.[p]
  );
  if (hasPermission) return children;
  // Redirect to their correct landing page
  const landing = getAdminLandingPage('SBM', user?.permissions);
  return <Navigate to={landing} replace />;
};

// Redirects SuperAdmin/SBM/RM away from tenant-only pages (Dashboard, Uploads, etc.)
const TenantOnly = ({ children }) => {
  const { user, isImpersonating } = useAuth();
  const adminLanding = getAdminLandingPage(user?.role, user?.permissions);
  if (adminLanding && !isImpersonating) {
    return <Navigate to={adminLanding} replace />;
  }
  return children;
};

// Prevents accessing Admin/RM pages while actively impersonating a tenant
const NotImpersonating = ({ children }) => {
  const { isImpersonating } = useAuth();
  if (isImpersonating) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Cross-tenant oversight roles — SuperAdmin (MVP validation) and SBM both have no tenant of
// their own, so they get a read-only view of the Campaigns page (no create/rename/delete)
// instead of the tenant-facing create/manage flow. RM is deliberately excluded: RM's "my
// tenants" model is a different shape of oversight, not covered by this page.
const CROSS_TENANT_LISTING_STUDIO_ROLES = ['SuperAdmin', 'SBM'];

// Speedy Listing: SuperAdmin/SBM have access when acting as themselves (MVP validation);
// while impersonating (or when actually Admin), the impersonated/own tenant's
// listingStudioEnabled applies (tenant-configurable via LISTING_STUDIO_ALLOWED_TENANT_IDS
// on the server) — mirrors the Sidebar's own check.
const ListingStudioGuard = ({ children }) => {
  const { user, isImpersonating, impersonationSyncing } = useAuth();
  if (CROSS_TENANT_LISTING_STUDIO_ROLES.includes(user?.role) && !isImpersonating) return children;
  // Right after startImpersonating flips isImpersonating, listingStudioEnabled on `user` still
  // belongs to the impersonator's own account until the profile refetch resolves — deciding on
  // it here would race that refetch. Render nothing for that brief window instead of guessing.
  if (isImpersonating && impersonationSyncing) return null;
  if ((user?.role === 'Admin' || isImpersonating) && user?.listingStudioEnabled !== false) return children;
  const landing = getAdminLandingPage(user?.role, user?.permissions) || '/dashboard';
  return <Navigate to={landing} replace />;
};

// Neither SuperAdmin nor SBM can create campaigns (no tenant of their own), so the Home page's
// "create a campaign" CTAs — and the Campaigns page's own "New campaign"/"Create your first
// campaign" (hidden for them there, see ProjectsPage's isCrossTenant) — are dead ends for
// them; ListingStudioIndex below sends them straight to the Campaigns list instead.
// Brandkits are tenant-owned; SuperAdmin/SBM acting as themselves (no tenant of their own —
// see CROSS_TENANT_LISTING_STUDIO_ROLES above) have nothing to manage here, the same reason
// ProjectsPage already hides create/rename/delete for them on the Campaigns page.
const ListingStudioCrossTenantBlocked = ({ children }) => {
  const { user, isImpersonating } = useAuth();
  if (CROSS_TENANT_LISTING_STUDIO_ROLES.includes(user?.role) && !isImpersonating) {
    return <Navigate to="/listing-studio/campaigns" replace />;
  }
  return children;
};

const ListingStudioIndex = () => {
  const { user, isImpersonating } = useAuth();
  const location = useLocation();
  if (CROSS_TENANT_LISTING_STUDIO_ROLES.includes(user?.role) && !isImpersonating) {
    return <Navigate to="/listing-studio/campaigns" replace />;
  }
  // Fresh session: land on the Speedy Listing Home page. Once a campaign was started this
  // session (until logout), land on the Campaigns history instead. The shell logo passes
  // state.home to always reach Home. Not while impersonating: the flag belongs to the
  // impersonator's own session.
  if (!isImpersonating && !location.state?.home && hasStartedCampaign()) {
    return <Navigate to="/listing-studio/campaigns" replace />;
  }
  return <ListingStudioHomePage />;
};

// Prevents standard users from accessing pages they don't have permission for
const UserPermissionRequired = ({ permission, children }) => {
  const { user, isImpersonating } = useAuth();
  if (user?.role === 'Admin' || isImpersonating) return children;
  const perms = Array.isArray(permission) ? permission : [permission];
  const hasPermission = perms.some(p => user?.permissions?.[p]);
  if (hasPermission) return children;
  return <Navigate to="/dashboard" replace />;
};

// Role-aware catch-all redirect
const DefaultRedirect = () => {
  const { user, isImpersonating } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const adminLanding = getAdminLandingPage(user?.role, user?.permissions);
  if (adminLanding && !isImpersonating) {
    return <Navigate to={adminLanding} replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }} basename="/client">
      <AuthProvider>
        <MarketplaceProvider>
          {/* Sits above the routes on purpose: a tour that walks from the
              dashboard to uploads has to survive navigation, and
              DashboardLayout remounts on every route change. */}
          <TourProvider>
          <Toaster position="top-center" richColors />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            {/* Public, view-only Amazon Preview share link — the token is the credential, no login. */}
            <Route path="/preview/:token" element={<ListingStudioPublicPreviewPage />} />

          <Route element={<ProtectedRoute />}>
            {/* Tenant-only pages: redirect admin-side users to their landing page */}
            <Route path="/dashboard" element={<TenantOnly><Dashboard /></TenantOnly>} />
            <Route path="/uploads" element={<TenantOnly><UserPermissionRequired permission={['uploadNew', 'uploadHistory']}><Uploads /></UserPermissionRequired></TenantOnly>} />
            <Route path="/upload-history/:uploadId" element={<TenantOnly><UserPermissionRequired permission={['uploadNew', 'uploadHistory']}><UploadDetails /></UserPermissionRequired></TenantOnly>} />
            <Route path="/users" element={<TenantOnly><UserManagement /></TenantOnly>} />
            <Route path="/settings/marketplace" element={<TenantOnly><UserPermissionRequired permission="marketplace"><MarketplaceSettings /></UserPermissionRequired></TenantOnly>} />
            <Route path="/subscription" element={<TenantOnly><UserPermissionRequired permission="billing"><Subscription /></UserPermissionRequired></TenantOnly>} />
            <Route path="/cost-sheet" element={<TenantOnly><CostSheet /></TenantOnly>} />
            <Route path="/payments/calculations" element={<TenantOnly><PaymentsCalculations /></TenantOnly>} />
            <Route path="/payments/settlements" element={<TenantOnly><PaymentsSettlements /></TenantOnly>} />
            <Route path="/payments/details" element={<TenantOnly><MarketplacePaymentDetails /></TenantOnly>} />
            <Route path="/downloads" element={<TenantOnly><UserPermissionRequired permission="downloads"><Downloads /></UserPermissionRequired></TenantOnly>} />
            <Route path="/returns/scan" element={<TenantOnly><UserPermissionRequired permission="scanReturns"><ScanReturns /></UserPermissionRequired></TenantOnly>} />
            <Route path="/support" element={<TenantOnly><UserPermissionRequired permission="support"><SupportPortal /></UserPermissionRequired></TenantOnly>} />
            <Route path="/speedy-agent" element={<TenantOnly><UserPermissionRequired permission="speedAi"><SpeedyAgentPage /></UserPermissionRequired></TenantOnly>} />

            {/* Shared pages */}
            <Route path="/profile" element={<ProfileSettings />} />
            <Route path="/admin/approvals" element={<NotImpersonating><SBMPermissionGuard requiredPermission={['approveTenants', 'approveSubscriptions', 'rejectRegistrations']}><AdminApprovals /></SBMPermissionGuard></NotImpersonating>} />
            <Route path="/uploads" element={<Uploads />} />
            <Route path="/upload-history/:uploadId" element={<UploadDetails />} />
            <Route path="/admin/tenants" element={<NotImpersonating><SBMPermissionGuard requiredPermission="viewTenants"><SuperAdminTenants /></SBMPermissionGuard></NotImpersonating>} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/settings/marketplace" element={<MarketplaceSettings />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/cost-sheet" element={<CostSheet />} />
            <Route path="/payments/calculations">
              <Route index element={<PaymentsCalculations />} />
              <Route path="master-sku" element={<MasterSkuCalculations />} />
            </Route>
            <Route path="/payments/settlements" element={<PaymentsSettlements />} />
            <Route path="/payments/details" element={<MarketplacePaymentDetails />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/returns/scan" element={<ScanReturns />} />
            <Route path="/admin/pricing" element={<NotImpersonating><SBMPermissionGuard requiredPermission="viewPricing"><SuperAdminPricing /></SBMPermissionGuard></NotImpersonating>} />
            <Route path="/speedy-agent" element={<SpeedyAgentPage />} />
            <Route path="/listing-studio/*" element={<ListingStudioGuard><ListingStudioShell /></ListingStudioGuard>}>
              <Route index element={<ListingStudioIndex />} />
              <Route path="campaigns" element={<ListingStudioProjectsPage />} />
              <Route
                path="brandkits"
                element={
                  <ListingStudioCrossTenantBlocked>
                    <ListingStudioBrandkitsPage />
                  </ListingStudioCrossTenantBlocked>
                }
              />
              <Route path="products" element={<ListingStudioMyProductsPage />} />
              <Route path="new" element={<ListingStudioNewCampaignPage />} />
              <Route path="p/:id" element={<ListingStudioProjectLayout />}>
                <Route index element={<Navigate to="research" replace />} />
                <Route path="processing" element={<ListingStudioProcessingPage />} />
                <Route path="research" element={<ListingStudioResearchPage />} />
                <Route path="strategy" element={<ListingStudioStrategyPage />} />
                <Route path="aplus" element={<ListingStudioAplusPage />} />
                <Route path="premium-aplus" element={<ListingStudioPremiumAplusPage />} />
                <Route path="listing" element={<ListingStudioListingPage />} />
                <Route path="preview" element={<ListingStudioListingPage startInPreview />} />
                <Route path="images" element={<ListingStudioImagesPage />} />
                <Route
                  path="videos"
                  element={<ComingSoonPage icon={Video} title="Videos" description="Generate and manage listing videos for this campaign. This feature is on its way." />}
                />
                <Route path="compare" element={<ListingStudioComparisonShelfPage />} />
                <Route path="readiness" element={<ListingStudioAlexaReadinessPage />} />
                <Route
                  path="variants"
                  element={<ComingSoonPage icon={Boxes} title="Variants" description="Manage product variants (size, color, style) for this campaign. This feature is on its way." />}
                />
              </Route>
            </Route>

            <Route path="/admin/roles" element={<NotImpersonating><SBMPermissionGuard requiredPermission="manageRM"><SBMRMManagement /></SBMPermissionGuard></NotImpersonating>} />
            <Route path="/rm/tenants" element={<NotImpersonating><RMTenantList /></NotImpersonating>} />
            <Route path="/admin/support" element={<NotImpersonating><SBMPermissionGuard requiredPermission="viewSupport"><AdminSupport /></SBMPermissionGuard></NotImpersonating>} />
            <Route path="/admin/invoices" element={<NotImpersonating><SBMPermissionGuard requiredPermission="manageInvoices"><AdminInvoiceList /></SBMPermissionGuard></NotImpersonating>} />
            <Route path="/admin/payments" element={<NotImpersonating><SuperAdminPayments /></NotImpersonating>} />
          </Route >

          <Route path="*" element={<DefaultRedirect />} />
        </Routes >
        {/* <SpeedyAgent /> */}
          </TourProvider>
      </MarketplaceProvider>
      </AuthProvider >
    </Router >
  );
}

export default App;