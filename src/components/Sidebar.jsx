import React, { useState } from 'react';
import {
    LayoutDashboard, CheckCircle, Upload, Building, User, ChevronDown,
    Settings, ShoppingBag, CreditCard, UserPen, Download, PackageOpen, ScanLine, BarChart3, DollarSign, Sparkles, LifeBuoy, FileText
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { TOUR } from '../tour/targets';

const Sidebar = () => {
    const location = useLocation();
    const { user, isImpersonating, impersonatedTenant, impersonationSyncing } = useAuth();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const NAV_TOUR_MAP = {
        '/dashboard': TOUR.nav.dashboard,
        '/uploads': TOUR.nav.uploads,
        '/downloads': TOUR.nav.downloads,
        '/returns/scan': TOUR.nav.scanReturns,
        '/support': TOUR.nav.support,
        '/speedy-agent': TOUR.nav.speedyAi,
        '/settings/marketplace': TOUR.nav.settingsMarketplace,
        '/users': TOUR.nav.settingsUsers,
        '/subscription': TOUR.nav.settingsBilling,
        '/profile': TOUR.nav.profile,
        '/admin/approvals': TOUR.nav.adminApprovals,
        '/admin/tenants': TOUR.nav.adminTenants,
        '/admin/pricing': TOUR.nav.adminPricing,
        '/admin/roles': TOUR.nav.adminRoles,
        '/admin/invoices': TOUR.nav.adminInvoices,
        '/admin/support': TOUR.nav.adminSupport,
        '/rm/tenants': TOUR.nav.rmTenants,
    };

    let menuItems = [];

    if (['SuperAdmin', 'SBM'].includes(user?.role) && !isImpersonating) {
        menuItems = [];
        // Approvals (if SuperAdmin or SBM with any approval-related permission)
        if (user?.role === 'SuperAdmin' || user?.permissions?.approveTenants || user?.permissions?.approveSubscriptions || user?.permissions?.rejectRegistrations) {
            menuItems.push({ name: 'Approvals', icon: CheckCircle, path: '/admin/approvals' });
        }
        // Tenants - SuperAdmin always, SBM if they have viewTenants permission
        if (user?.role === 'SuperAdmin' || user?.permissions?.viewTenants) {
            menuItems.push({ name: 'Tenants', icon: Building, path: '/admin/tenants' });
        }
        // Pricing - SuperAdmin always, SBM only if viewPricing permission
        if (user?.role === 'SuperAdmin' || user?.permissions?.viewPricing) {
            menuItems.push({ name: 'Pricing', icon: DollarSign, path: '/admin/pricing' });
        }
        // Manage Roles - SuperAdmin always, SBM only if manageRM permission
        if (user?.role === 'SuperAdmin' || user?.permissions?.manageRM) {
            menuItems.push({ name: 'Manage Roles', icon: UserPen, path: '/admin/roles' });
        }
        // Invoices - SuperAdmin always, SBM only if manageInvoices permission
        if (user?.role === 'SuperAdmin' || user?.permissions?.manageInvoices) {
            menuItems.push({ name: 'Invoices', icon: FileText, path: '/admin/invoices' });
        }

        // Support Portal — SuperAdmin always, SBM only if viewSupport permission
        if (user?.role === 'SuperAdmin' || user?.permissions?.viewSupport !== false) {
            menuItems.push({ name: 'Support', icon: LifeBuoy, path: '/admin/support' });
        }

        // Speedy Listing — SuperAdmin and SBM (MVP validation); both land on the same
        // Campaigns page as everyone else, but read-only (see CROSS_TENANT_LISTING_STUDIO_ROLES
        // in App.jsx)
        if (user?.role === 'SuperAdmin' || user?.role === 'SBM') {
            menuItems.push({ name: 'Speedy Listing', icon: PackageOpen, path: '/listing-studio' });
        }
    } else if (user?.role === 'RM' && !isImpersonating) {
        menuItems = [
            { name: 'My Tenants', icon: Building, path: '/rm/tenants' },
            { name: 'Support', icon: LifeBuoy, path: '/admin/support' },
        ];
    } else if (user?.role === 'Admin' || isImpersonating) {
        const adminItems = [
            { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
            { name: 'Uploads', icon: Upload, path: '/uploads' },
            { name: 'Downloads', icon: Download, path: '/downloads' },
            { name: 'Scan Returns', icon: ScanLine, path: '/returns/scan' },
            // Speedy Listing — tenant-configurable via LISTING_STUDIO_ALLOWED_TENANT_IDS
            // (defaults to enabled when that env var is unset). Hidden while impersonationSyncing
            // is true: right after startImpersonating flips isImpersonating, listingStudioEnabled
            // still belongs to the impersonator's own account until the profile refetch resolves
            // (see ListingStudioGuard in App.jsx, which this mirrors) — omit the item rather than
            // flash it in/out on a stale value.
            ...(user?.listingStudioEnabled !== false && !(isImpersonating && impersonationSyncing)
              ? [{ name: 'Speedy Listing', icon: PackageOpen, path: '/listing-studio' }]
              : []),
            { name: 'Support', icon: LifeBuoy, path: '/support' }
        ];

        menuItems = [...adminItems];
    } else {
        // Standard User — items shown based on permissions
        menuItems = [];

        const hasDashboardAccess = user?.permissions?.actionRequired
            || user?.permissions?.orderAnalysis
            || user?.permissions?.paymentAnalysis
            || user?.permissions?.adsAnalysis
            || user?.permissions?.returnsAnalysis;

        if (hasDashboardAccess) {
            menuItems.push({ name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' });
        }

        if (user?.permissions?.uploadNew || user?.permissions?.uploadHistory) {
            menuItems.push({ name: 'Uploads', icon: Upload, path: '/uploads' });
        }
        if (user?.permissions?.downloads) {
            menuItems.push({ name: 'Downloads', icon: Download, path: '/downloads' });
        }
        if (user?.permissions?.scanReturns) {
            menuItems.push({ name: 'Scan Returns', icon: ScanLine, path: '/returns/scan' });
        }
        if (user?.permissions?.support) {
            menuItems.push({ name: 'Support', icon: LifeBuoy, path: '/support' });
        }
    }

    const NavItem = ({ item, isActive }) => (
        <Link
            data-tour={NAV_TOUR_MAP[item.path]}
            to={item.path}
            className={`group flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-full transition-all duration-200 ${isActive
                ? 'bg-brand-50/60 text-brand-700 shadow-[0_2px_4px_rgba(0,0,0,0.02)] border border-brand-100/50'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/50 border border-transparent'
                }`}
        >
            <item.icon
                size={20}
                strokeWidth={isActive ? 2.5 : 2}
                className={`transition-colors duration-200 ${isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`}
            />
            <span className={isActive ? 'font-semibold tracking-wide' : ''}>{item.name}</span>
            {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-600 shadow-sm"></div>
            )}
        </Link>
    );

    return (
        <div className="w-60 bg-slate-100 h-full flex flex-col font-sans transition-all duration-300 relative z-20">
            {/* Logo Section */}
            <div className="h-20 flex items-center px-6">
                <div className="flex items-center">
                    <img src={`${import.meta.env.BASE_URL}assets/speedecom.png`} alt="SpeedEcom" className="h-10 w-auto rounded-lg shadow-sm" />
                </div>
            </div>

            {/* Menu Header */}
            <div className="px-6 py-6 flex justify-between items-end">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest pl-2">Main Menu</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
                {menuItems.map((item) => {
                    const isActive = item.path === '/listing-studio'
                        ? location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
                        : location.pathname === item.path;
                    return <NavItem key={item.name} item={item} isActive={isActive} />;
                })}

                {/* Speedy Agent — special AI button (Admin, or User with speedAi permission) */}
                {(user?.role === 'Admin' || isImpersonating || user?.permissions?.speedAi) && (
                    <Link
                        data-tour={TOUR.nav.speedyAi}
                        to="/speedy-agent"
                        className="group flex items-center gap-3 px-4 py-3.5 text-sm font-semibold rounded-xl
                            transition-all duration-300
                            bg-gradient-to-r from-sky-50 to-blue-50
                            hover:from-sky-100 hover:to-blue-100
                            text-blue-700 hover:text-blue-800
                            border border-blue-200/60 hover:border-blue-300
                            shadow-sm hover:shadow-md hover:shadow-blue-100/50
                            relative overflow-hidden"
                    >
                        {/* Animated shimmer overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent
                            -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center
                            shadow-md shadow-blue-400/30 relative z-10">
                            <Sparkles size={15} className="text-white" />
                        </div>
                        <span className="relative z-10">Speedy AI</span>
                        <span className="ml-auto relative z-10 text-[9px] font-bold uppercase tracking-wider
                            bg-gradient-to-r from-sky-600 to-blue-700 text-white
                            px-1.5 py-0.5 rounded-md">
                            AI
                        </span>
                    </Link>
                )}

                {/* Settings Section for Admin */}
                {(user?.role === 'Admin' || isImpersonating) && (
                    <div className="mt-4 pt-4 border-t border-slate-50">
                        <div
                            data-tour={TOUR.nav.settings}
                            className="flex items-center justify-between px-4 py-2 cursor-pointer text-slate-400 hover:text-slate-600"
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        >
                            <span className="text-xs font-bold uppercase tracking-widest pl-2">Settings</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isSettingsOpen ? '' : '-rotate-90'}`} />
                        </div>

                        {isSettingsOpen && (
                            <div className="mt-1 space-y-1">
                                {/* Marketplace */}
                                <NavItem
                                    item={{ name: 'Marketplace', icon: ShoppingBag, path: '/settings/marketplace' }}
                                    isActive={location.pathname === '/settings/marketplace'}
                                />
                                <NavItem
                                    item={{ name: 'User Management', icon: User, path: '/users' }}
                                    isActive={location.pathname === '/users'}
                                />
                                <NavItem
                                    item={{ name: 'Billing', icon: CreditCard, path: '/subscription' }}
                                    isActive={location.pathname === '/subscription'}
                                />
                                {/* Account Settings - Future */}
                                {/* <NavItem item={{ name: 'Account Settings', icon: User, path: '/settings/account' }} isActive={location.pathname === '/settings/account'} /> */}
                            </div>
                        )}
                    </div>
                )}

                {/* Settings Section for User (permission-based) */}
                {user?.role === 'User' && !isImpersonating && (user?.permissions?.marketplace || user?.permissions?.billing) && (
                    <div className="mt-4 pt-4 border-t border-slate-50">
                        <div
                            data-tour={TOUR.nav.settings}
                            className="flex items-center justify-between px-4 py-2 cursor-pointer text-slate-400 hover:text-slate-600"
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        >
                            <span className="text-xs font-bold uppercase tracking-widest pl-2">Settings</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isSettingsOpen ? '' : '-rotate-90'}`} />
                        </div>

                        {isSettingsOpen && (
                            <div className="mt-1 space-y-1">
                                {user?.permissions?.marketplace && (
                                    <NavItem
                                        item={{ name: 'Marketplace', icon: ShoppingBag, path: '/settings/marketplace' }}
                                        isActive={location.pathname === '/settings/marketplace'}
                                    />
                                )}
                                {user?.permissions?.billing && (
                                    <NavItem
                                        item={{ name: 'Billing', icon: CreditCard, path: '/subscription' }}
                                        isActive={location.pathname === '/subscription'}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </nav>

            {/* User Profile / Footer Mockup */}
            <div className="p-4 mt-2">
                <Link
                    to="/profile"
                    className="bg-white/50 rounded-xl p-3 flex items-center gap-3 hover:bg-slate-100 transition-colors cursor-pointer shadow-sm border border-slate-100/50"
                >
                    <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shadow-inner overflow-hidden">
                        {user?.profilePicture ? (
                            <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                        ) : isImpersonating ? (
                            impersonatedTenant?.adminName ? impersonatedTenant.adminName.charAt(0).toUpperCase() : (impersonatedTenant?.name?.charAt(0).toUpperCase() || 'A')
                        ) : (
                            user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">
                            {isImpersonating ? (impersonatedTenant?.adminName || impersonatedTenant?.name || 'Tenant Admin') : (user?.fullName || 'User')}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                            {isImpersonating ? (impersonatedTenant?.adminEmail || 'No Email') : (user?.email || 'No Email')}
                        </p>
                    </div>
                </Link>
            </div>
        </div>
    );
};

export default Sidebar;