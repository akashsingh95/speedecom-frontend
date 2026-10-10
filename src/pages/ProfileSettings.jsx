// import React, { useState, useEffect, useMemo } from 'react';
// import DashboardLayout from '../components/DashboardLayout';
// import { useAuth } from '../AuthContext';
// import api, { encryptPassword } from '../api';
// import CreditsTab from '../components/dashboard/CreditsTab';
// import ViewToggle from '../components/ViewToggle';
// import { User, Lock, Building, CreditCard, CheckCircle, Eye, EyeOff, ShieldCheck, Calendar, X, LogOut, Edit, Check, Plus, Settings, Camera, FileText, Save, Loader2, Hash } from 'lucide-react';
// import { parseGstin } from '../utils/gstinUtils';
// import GstAutoFill from '../components/GstAutoFill';
// import { toast } from 'sonner';
// import { getMarketplaceLogo } from '../utils/marketplaceLogos';

// const ProfileSettings = () => {
//     const { user: contextUser, updateUserInContext, logout, isImpersonating } = useAuth();
//     const [loading, setLoading] = useState(true);
//     const [profileData, setProfileData] = useState(null);

//     // Tab state
//     const [activeTab, setActiveTab] = useState('personal');
//     const [creditsViewMode, setCreditsViewMode] = useState(() => localStorage.getItem('profileCreditsViewMode') || 'grid');

//     // Profile update state
//     const [fullName, setFullName] = useState('');
//     const [mobileNumber, setMobileNumber] = useState('');
//     const [savingProfile, setSavingProfile] = useState(false);
//     const [isEditMode, setIsEditMode] = useState(false);
//     const [uploadingPhoto, setUploadingPhoto] = useState(false);

//     // Marketplace popup state
//     const [selectedMarketplace, setSelectedMarketplace] = useState(null);

//     const handleOpenMarketplace = async (name, accounts) => {
//         try {
//             const { data: res } = await api.get('/marketplaces');
//             const groups = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
//             const accMap = {};
//             groups.forEach(g => (g.accounts || []).forEach(a => { accMap[a._id] = a; }));
//             const enriched = accounts.map(acc => {
//                 const full = accMap[acc.marketplaceId] || {};
//                 return { ...acc, ...full };
//             });
//             setSelectedMarketplace({ name, accounts: enriched });
//         } catch {
//             setSelectedMarketplace({ name, accounts });
//         }
//     };

//     // Password modal state
//     const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

//     // Logout modal state
//     const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
//     const [dontAskAgain, setDontAskAgain] = useState(false);

//     // Live balance state (fetched fresh on org tab)
//     const [liveBalance, setLiveBalance] = useState(null);

//     // GST details state (Admin only)
//     const [gstData, setGstData]             = useState(null);   // null = not loaded yet
//     const [gstEditMode, setGstEditMode]     = useState(false);
//     const [gstForm, setGstForm]             = useState({ businessName: '', gstin: '', pan: '', address: '', state: '', stateCode: '', phone: '' });
//     const [savingGst, setSavingGst]         = useState(false);
//     const [gstinError, setGstinError]       = useState('');
//     const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

//     // Password change state
//     const [currentPassword, setCurrentPassword] = useState('');
//     const [newPassword, setNewPassword] = useState('');
//     const [confirmPassword, setConfirmPassword] = useState('');
//     const [showCurrentPassword, setShowCurrentPassword] = useState(false);
//     const [showNewPassword, setShowNewPassword] = useState(false);
//     const [showConfirmPassword, setShowConfirmPassword] = useState(false);
//     const [changingPassword, setChangingPassword] = useState(false);
//     const [passwordStrength, setPasswordStrength] = useState(0);

//     // System Settings state (SuperAdmin)
//     const [systemSettings, setSystemSettings] = useState({ nextTenantId: 1000 });
//     const [settingsLoading, setSettingsLoading] = useState(false);
//     const [nextInvoiceNumber, setNextInvoiceNumber] = useState('');
//     const [invoiceSeqDraft, setInvoiceSeqDraft] = useState('');
//     const [savingSeq, setSavingSeq] = useState(false);

//     useEffect(() => {
//         fetchProfile();
//     }, []);

//     useEffect(() => {
//         calculatePasswordStrength(newPassword);
//     }, [newPassword]);

//     useEffect(() => {
//         localStorage.setItem('profileCreditsViewMode', creditsViewMode);
//     }, [creditsViewMode]);

//     // Reset tab if active tab permission is revoked
//     useEffect(() => {
//         if (activeTab === 'credits' && !(contextUser?.permissions?.creditUsage ?? true)) {
//             setActiveTab('personal');
//         }
//     }, [contextUser?.permissions?.creditUsage, activeTab]);

//     // Fetch live balance when org tab is active
//     useEffect(() => {
//         if (activeTab === 'organization' && profileData?.tenantId?._id) {
//             api.get(`/credits/balance?tenantId=${profileData.tenantId._id}`)
//                 .then(res => setLiveBalance(res.data?.billedBalance ?? null))
//                 .catch(() => {});
//         }
//     }, [activeTab, profileData?.tenantId?._id]);

//     const fetchProfile = async () => {
//         try {
//             const { data } = await api.get('/auth/profile');
//             setProfileData(data);
//             setFullName(data.fullName);
//             setMobileNumber(data.mobileNumber || '');
//             // Load GST details for Admin
//             if (data.role === 'Admin') {
//                 try {
//                     const { data: gst } = await api.get('/auth/gst-details');
//                     setGstData(gst || {});
//                     setGstForm({
//                         businessName: gst?.businessName || '',
//                         gstin:        gst?.gstin        || '',
//                         pan:          gst?.pan          || '',
//                         address:      gst?.address      || '',
//                         state:        gst?.state        || '',
//                         stateCode:    gst?.stateCode    || '',
//                         phone:        gst?.phone        || '',
//                     });
//                 } catch { setGstData({}); }
//             }
//         } catch (error) {
//             console.error('Error fetching profile:', error);
//             toast.error('Failed to load profile');
//         } finally {
//             setLoading(false);
//         }
//     };

//     const fetchSystemSettings = async () => {
//         setSettingsLoading(true);
//         try {
//             const res = await api.get('/superadmin/settings');
//             const data = res.data;
//             setSystemSettings({ nextTenantId: data.nextTenantId ?? 1000 });
//             setNextInvoiceNumber(data.nextInvoiceNumber || '');
//             setInvoiceSeqDraft(String(data.nextInvoiceSequence ?? ''));
//         } catch (error) {
//             console.error('Error fetching system settings:', error);
//         } finally {
//             setSettingsLoading(false);
//         }
//     };

//     useEffect(() => {
//         if (contextUser?.role === 'SuperAdmin') {
//             fetchSystemSettings();
//         }
//     }, [contextUser?.role]);

//     const handleSaveInvoiceSequence = async () => {
//         const seq = parseInt(invoiceSeqDraft, 10);
//         if (isNaN(seq) || seq < 1) {
//             toast.error('Enter a valid invoice sequence number');
//             return;
//         }
//         setSavingSeq(true);
//         try {
//             const res = await api.put('/superadmin/settings', { nextInvoiceSequence: seq });
//             const data = res.data;
//             setNextInvoiceNumber(data.nextInvoiceNumber || '');
//             setInvoiceSeqDraft(String(data.nextInvoiceSequence ?? ''));
//             toast.success('Invoice sequence updated');
//         } catch (error) {
//             toast.error(error?.response?.data?.message || 'Failed to update invoice sequence');
//         } finally {
//             setSavingSeq(false);
//         }
//     };

//     const handleGstinChange = (value) => {
//         const g = value.toUpperCase();
//         setGstForm(f => ({ ...f, gstin: g }));
//         setGstinError('');
//         if (g.length === 15) {
//             if (!GSTIN_RE.test(g)) { setGstinError('Invalid GSTIN format'); return; }
//             const parsed = parseGstin(g);
//             if (parsed.valid) {
//                 setGstForm(f => ({
//                     ...f,
//                     gstin:     g,
//                     pan:       parsed.pan,
//                     state:     parsed.stateName || f.state,
//                     stateCode: parsed.stateCode,
//                 }));
//             }
//         }
//     };

//     const handleProfileGstFetched = (data) => {
//         setGstForm(f => ({
//             ...f,
//             businessName: data.businessName || f.businessName,
//             address: data.address || f.address,
//             pan: data.pan || f.pan,
//             state: data.state || f.state,
//             stateCode: data.stateCode || f.stateCode,
//         }));
//     };

//     const handleSaveGst = async (e) => {
//         e.preventDefault();
//         if (gstForm.gstin && !GSTIN_RE.test(gstForm.gstin)) { setGstinError('Invalid GSTIN format'); return; }
//         setSavingGst(true);
//         try {
//             const { data } = await api.put('/auth/gst-details', gstForm);
//             setGstData(data);
//             setGstEditMode(false);
//             toast.success('Business & GST details saved');
//         } catch { /* handled by interceptor */ }
//         finally { setSavingGst(false); }
//     };

//     const calculatePasswordStrength = (password) => {
//         let strength = 0;
//         if (password.length >= 8) strength += 25;
//         if (password.length >= 12) strength += 25;
//         if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
//         if (/\d/.test(password)) strength += 25;
//         setPasswordStrength(strength);
//     };

//     const handleUpdateProfile = async (e) => {
//         e.preventDefault();

//         if (!fullName || fullName.trim().length < 2) {
//             toast.error('Full name must be at least 2 characters');
//             return;
//         }

//         if (fullName.length > 50) {
//             toast.error('Full name must not exceed 50 characters');
//             return;
//         }

//         // Validate mobile number if provided
//         if (mobileNumber && mobileNumber.trim()) {
//             const cleaned = mobileNumber.replace(/[\s-]/g, '');
//             const mobileRegex = /^(\+91)?[6-9]\d{9}$/;
//             if (!mobileRegex.test(cleaned)) {
//                 toast.error('Invalid mobile number. Use +91XXXXXXXXXX or 10 digits starting with 6-9');
//                 return;
//             }
//         }

//         setSavingProfile(true);
//         try {
//             const { data } = await api.put('/auth/profile', {
//                 fullName: fullName.trim(),
//                 mobileNumber: mobileNumber.trim() || undefined
//             });
//             setProfileData(data);
//             toast.success('Profile updated successfully');
//             setIsEditMode(false); // Exit edit mode

//             // Update context
//             if (updateUserInContext) {
//                 updateUserInContext({ fullName: data.fullName });
//             }
//         } catch (error) {
//             console.error('Error updating profile:', error);
//             // Error toast is handled by global interceptor
//         } finally {
//             setSavingProfile(false);
//         }
//     };

//     // Function to handle file selection and upload
//     const handlePhotoChange = async (e) => {
//         const file = e.target.files[0];
//         if (!file) return;
//         // Validation
//         if (file.size > 2 * 1024 * 1024) { // 2MB
//             toast.error('Image size should be less than 2MB');
//             return;
//         }
//         if (!file.type.startsWith('image/')) {
//             toast.error('Please upload an image file');
//             return;
//         }
//         try {
//             setUploadingPhoto(true);
//             // Get Signed URL
//             const { data: { uploadUrl, key } } = await api.get(`/auth/profile/upload-url?fileType=${file.type}`);
//             // Upload to GCS
//             await fetch(uploadUrl, {
//                 method: 'PUT',
//                 body: file,
//                 headers: {
//                     'Content-Type': file.type,
//                 },
//             });
//             // Update Profile with new Image Key/URL 
//             const gcsBaseUrl = `https://storage.googleapis.com/speedecom_stage`;
//             const finalImageUrl = `${gcsBaseUrl}/${key}`;

//             // Update User Profile in DB
//             const { data: updatedUser } = await api.put('/auth/profile', {
//                 fullName: profileData.fullName, // Keep existing name
//                 profilePicture: finalImageUrl
//             });
//             setProfileData(updatedUser);
//             if (updateUserInContext) updateUserInContext(updatedUser);

//             toast.success('Profile picture updated successfully');
//         } catch (error) {
//             console.error('Photo upload error:', error);
//             toast.error('Failed to upload profile picture');
//         } finally {
//             setUploadingPhoto(false);
//         }
//     };

//     const handleChangePassword = async (e) => {
//         e.preventDefault();

//         // Validation
//         if (!currentPassword || !newPassword || !confirmPassword) {
//             toast.error('All password fields are required');
//             return;
//         }

//         if (newPassword.length < 8) {
//             toast.error('New password must be at least 8 characters');
//             return;
//         }

//         if (newPassword !== confirmPassword) {
//             toast.error('New passwords do not match');
//             return;
//         }

//         if (currentPassword === newPassword) {
//             toast.error('New password must be different from current password');
//             return;
//         }

//         setChangingPassword(true);
//         try {
//             const encryptedCurrent = await encryptPassword(currentPassword);
//             const encryptedNew = await encryptPassword(newPassword);

//             await api.put('/auth/change-password', {
//                 currentPassword: encryptedCurrent,
//                 newPassword: encryptedNew
//             });

//             toast.success('Password changed successfully');

//             // Clear form and close modal
//             setCurrentPassword('');
//             setNewPassword('');
//             setConfirmPassword('');
//             setPasswordStrength(0);
//             setIsPasswordModalOpen(false);
//         } catch (error) {
//             console.error('Error changing password:', error);
//             // Error toast is handled by global interceptor
//         } finally {
//             setChangingPassword(false);
//         }
//     };

//     const closePasswordModal = () => {
//         setIsPasswordModalOpen(false);
//         setCurrentPassword('');
//         setNewPassword('');
//         setConfirmPassword('');
//         setPasswordStrength(0);
//         setShowCurrentPassword(false);
//         setShowNewPassword(false);
//         setShowConfirmPassword(false);
//     };

//     const handleSignOut = () => {
//         // Check if user has disabled confirmation
//         const skipConfirmation = localStorage.getItem('skipLogoutConfirmation') === 'true';

//         if (skipConfirmation) {
//             logout();
//         } else {
//             setIsLogoutModalOpen(true);
//         }
//     };

//     const confirmLogout = () => {
//         // Save preference if checkbox is checked
//         if (dontAskAgain) {
//             localStorage.setItem('skipLogoutConfirmation', 'true');
//         }

//         setIsLogoutModalOpen(false);
//         logout();
//     };

//     const cancelLogout = () => {
//         setIsLogoutModalOpen(false);
//         setDontAskAgain(false);
//     };


//     const handleEditMode = () => {
//         setIsEditMode(true);
//     };

//     const handleCancelEdit = () => {
//         setIsEditMode(false);
//         setFullName(profileData?.fullName);
//         setMobileNumber(profileData?.mobileNumber || '');
//     };

//     const getPasswordStrengthColor = () => {
//         if (passwordStrength <= 25) return 'bg-red-500';
//         if (passwordStrength <= 50) return 'bg-orange-500';
//         if (passwordStrength <= 75) return 'bg-yellow-500';
//         return 'bg-green-500';
//     };

//     const getPasswordStrengthText = () => {
//         if (passwordStrength <= 25) return 'Weak';
//         if (passwordStrength <= 50) return 'Fair';
//         if (passwordStrength <= 75) return 'Good';
//         return 'Strong';
//     };

//     const marketplaceGroups = useMemo(() => {
//         const groups = {};
//         (profileData?.tenantId?.activatedMarketplaces || []).forEach(mp => {
//             const key = mp.marketplaceName || mp.name || 'Unknown';
//             if (!groups[key]) groups[key] = [];
//             groups[key].push(mp);
//         });
//         return Object.entries(groups);
//     }, [profileData?.tenantId?.activatedMarketplaces]);

//     if (loading) {
//         return (
//             <DashboardLayout>
//                 <div className="flex items-center justify-center h-full">
//                     <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
//                 </div>
//             </DashboardLayout>
//         );
//     }

//     return (
//         <DashboardLayout>
//             <div className="w-full flex flex-col h-full overflow-hidden bg-slate-50">
//                 {/* Header */}
//                 <header className="bg-slate-50 backdrop-blur-md sticky top-0 z-10 px-8 py-3 flex items-center justify-between">
//                     <div>
//                         <h2 className="text-2xl font-heading font-bold text-slate-800">
//                             Profile Settings
//                         </h2>
//                     </div>
//                     {!isImpersonating && (
//                         <button
//                             onClick={handleSignOut}
//                             className="px-4 py-2 border-2 border-red-200 text-red-600 font-medium rounded-xl hover:bg-red-50 hover:border-red-300 transition-all flex items-center gap-2 shadow-sm text-sm"
//                         >
//                             <LogOut size={16} />
//                             Sign Out
//                         </button>
//                     )}
//                 </header>

// <main className="flex-1 w-full flex flex-col overflow-hidden relative">
//                     {/* Tab Navigation */}
//                     <div className="z-10 bg-slate-50/90 backdrop-blur-md pt-2 pb-3 px-4 md:px-8 border-b border-slate-200/40 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)] shrink-0">
//                         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
//                             <div className="flex items-center p-1.5 bg-slate-100/80 rounded-2xl overflow-x-auto custom-scrollbar w-full md:w-auto shadow-sm">
//                                 <button
//                                     onClick={() => setActiveTab('personal')}
//                                     className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'personal'
//                                         ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
//                                         : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
//                                         }`}
//                                 >
//                                     Personal Details
//                                 </button>

//                                 {profileData?.tenantId && (
//                                     <button
//                                         onClick={() => setActiveTab('organization')}
//                                         className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'organization'
//                                             ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
//                                             : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
//                                             }`}
//                                     >
//                                         Organization
//                                     </button>
//                                 )}

//                                 {!['SuperAdmin', 'SBM', 'RM'].includes(profileData?.role) && (contextUser?.permissions?.creditUsage ?? true) && (
//                                     <button
//                                         onClick={() => setActiveTab('credits')}
//                                         className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'credits'
//                                             ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
//                                             : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
//                                             }`}
//                                     >
//                                         Credit & Usage
//                                     </button>
//                                 )}
//                                 {profileData?.role === 'SuperAdmin' && (
//                                     <button
//                                         onClick={() => setActiveTab('system-settings')}
//                                         className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'system-settings'
//                                             ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
//                                             : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
//                                             }`}
//                                     >
//                                         System Settings
//                                     </button>
//                                 )}
//                             </div>
//                     </div>
//                 </div>

//                 {/* Scrollable Content */}
//                 <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-gradient-to-br from-gray-50 to-slate-100/80">

//                 {/* Tab Content */}
//                 <div>
//                     {activeTab === 'personal' && (
//                         <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
//                             {/* Avatar Section with Edit Button */}
//                             <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
//                                 <div className="flex items-center gap-4">
//                                     <div className="relative group">
//                                         {/* Avatar Image or Initials */}
//                                         <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-brand-500/20 overflow-hidden">
//                                             {profileData?.profilePicture ? (
//                                                 <img src={profileData.profilePicture} alt="Profile" className="w-full h-full object-cover" />
//                                             ) : (
//                                                 profileData?.fullName?.charAt(0)?.toUpperCase() || 'U'
//                                             )}
//                                         </div>
//                                         {/* Upload Overlay Button */}
//                                         {!isImpersonating && (
//                                             <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
//                                                 {uploadingPhoto ? (
//                                                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
//                                                 ) : (
//                                                     <Camera size={18} className="text-white" />
//                                                 )}
//                                                 <input
//                                                     type="file"
//                                                     className="hidden"
//                                                     accept="image/*"
//                                                     onChange={handlePhotoChange}
//                                                     disabled={uploadingPhoto}
//                                                 />
//                                             </label>
//                                         )}
//                                     </div>
//                                     <div>
//                                         <p className="text-lg font-semibold text-slate-700">{profileData?.fullName}</p>
//                                         <p className="text-sm text-slate-500 mt-1">{profileData?.email}</p>
//                                     </div>
//                                 </div>
//                                 {!isEditMode && !isImpersonating && (
//                                     <button
//                                         onClick={handleEditMode}
//                                         className="px-4 py-2 bg-brand-50 text-brand-600 font-medium rounded-xl hover:bg-brand-100 transition-colors flex items-center gap-2 border border-brand-200"
//                                     >
//                                         <Edit size={16} />
//                                         Edit
//                                     </button>
//                                 )}
//                             </div>

//                             <form onSubmit={handleUpdateProfile} className="space-y-6">
//                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                                     {/* Full Name */}
//                                     <div>
//                                         <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
//                                             Full Name
//                                         </label>
//                                         {isEditMode ? (
//                                             <input
//                                                 type="text"
//                                                 value={fullName}
//                                                 onChange={(e) => setFullName(e.target.value)}
//                                                 className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
//                                                 placeholder="Enter your full name"
//                                                 required
//                                                 autoFocus
//                                             />
//                                         ) : (
//                                             <p className="text-base font-medium text-slate-80">{profileData?.fullName}</p>
//                                         )}
//                                     </div>

//                                     {/* Mobile Number */}
//                                     <div>
//                                         <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
//                                             Mobile Number
//                                         </label>
//                                         {isEditMode ? (
//                                             <>
//                                                 <input
//                                                     type="tel"
//                                                     value={mobileNumber}
//                                                     onChange={(e) => setMobileNumber(e.target.value)}
//                                                     className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
//                                                     placeholder="+91XXXXXXXXXX"
//                                                     pattern="(\+91)?[6-9]\d{9}"
//                                                 />
//                                             </>
//                                         ) : (
//                                             <p className="text-base font-medium text-slate-800 ">
//                                                 {profileData?.mobileNumber || <span className="text-slate-400 italic">Not provided</span>}
//                                             </p>
//                                         )}
//                                     </div>

//                                     {/* Email (Read-only) */}
//                                     <div>
//                                         <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
//                                             Email Address
//                                         </label>
//                                         <div className="flex items-center gap-2 ">
//                                             <p className="text-base font-medium text-slate-600">{profileData?.email}</p>
//                                             <Lock className="text-slate-400" size={14} />
//                                         </div>
//                                         <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
//                                     </div>

//                                     {/* Role Badge */}
//                                     <div>
//                                         <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Role</label>
//                                         <div className="flex items-center gap-2 ">
//                                             <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${profileData?.role === 'SuperAdmin'
//                                                 ? 'bg-purple-50 text-purple-700 border border-purple-200'
//                                                 : profileData?.role === 'Admin'
//                                                     ? 'bg-blue-50 text-blue-700 border border-blue-200'
//                                                     : 'bg-slate-50 text-slate-700 border border-slate-200'
//                                                 }`}>
//                                                 <ShieldCheck size={14} />
//                                                 {profileData?.role}
//                                             </span>
//                                         </div>
//                                     </div>

//                                     {/* Account Status */}
//                                     <div>
//                                         <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Account Status</label>
//                                         <div className="flex items-center gap-2">
//                                             <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${profileData?.isApproved
//                                                 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
//                                                 : 'bg-amber-50 text-amber-700 border border-amber-200'
//                                                 }`}>
//                                                 <CheckCircle size={14} />
//                                                 {profileData?.isApproved ? 'Approved' : 'Pending Approval'}
//                                             </span>
//                                         </div>
//                                     </div>

//                                     {/* Member Since */}
//                                     <div>
//                                         <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Member Since</label>
//                                         <div className="flex items-center gap-2 text-base font-medium text-slate-800">
//                                             <Calendar size={16} className="text-slate-400" />
//                                             {new Date(profileData?.createdAt).toLocaleDateString('en-US', {
//                                                 year: 'numeric',
//                                                 month: 'long',
//                                                 day: 'numeric'
//                                             })}
//                                         </div>
//                                     </div>
//                                 </div>

//                                 {/* Action Buttons - Show only in edit mode */}
//                                 {isEditMode && (
//                                     <div className="flex gap-3 pt-6 border-t border-slate-100">
//                                         <button
//                                             type="submit"
//                                             disabled={savingProfile || (fullName === profileData?.fullName && mobileNumber === (profileData?.mobileNumber || ''))}
//                                             className="px-6 py-2.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-500/20 flex items-center gap-2"
//                                         >
//                                             <Check size={18} />
//                                             {savingProfile ? 'Saving...' : 'Save Changes'}
//                                         </button>
//                                         <button
//                                             type="button"
//                                             onClick={handleCancelEdit}
//                                             disabled={savingProfile}
//                                             className="px-6 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-2"
//                                         >
//                                             <X size={18} />
//                                             Cancel
//                                         </button>
//                                     </div>
//                                 )}

//                                 {/* Change Password Button - Always visible */}
//                                 <div className="pt-6 border-t border-slate-100">
//                                     <button
//                                         type="button"
//                                         onClick={() => setIsPasswordModalOpen(true)}
//                                         className="px-6 py-2.5 bg-amber-50 text-amber-700 font-medium rounded-xl hover:bg-amber-100 transition-colors border border-amber-200 flex items-center gap-2"
//                                     >
//                                         <Lock size={16} />
//                                         Change Password
//                                     </button>
//                                 </div>
//                             </form>
//                         </div>
//                     )}

//                     {activeTab === 'organization' && profileData?.tenantId && (
//                         <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
//                             <div className="flex items-center gap-3 mb-6">
//                                 <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
//                                     <Building className="text-indigo-600" size={20} />
//                                 </div>
//                                 <div>
//                                     <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
//                                         Organization Name
//                                     </label>
//                                     <p className="text-lg font-semibold text-slate-800">{profileData.tenantId.name}</p>
//                                 </div>
//                             </div>

//                             <div className="space-y-6">

//                                 {/* Current Balance - Admin Only */}
//                                 {profileData?.role === 'Admin' && (
//                                     <div className="bg-brand-50 rounded-xl px-4 py-3 border border-brand-100 flex justify-between items-center">
//                                         <div className="flex-col items-between h-full">
//                                             <label className="block text-xs font-medium text-brand-700 uppercase tracking-wider mb-2">
//                                                 Available Balance
//                                             </label>
//                                             <div className="flex items-center gap-3">
//                                                 <CreditCard className="text-brand-600" size={24} />
//                                                 <span className="text-3xl font-bold text-brand-600">
//                                                     {(liveBalance ?? profileData?.tenantId?.billedBalance ?? 0).toLocaleString()}
//                                                 </span>
//                                             </div>
//                                         </div>

//                                         {!isImpersonating && (
//                                             <a
//                                                 href="/client/subscription"
//                                                 className="px-4 h-10 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20 text-sm flex items-center gap-2"
//                                             >
//                                                 <Plus size={16} />
//                                                 Add Funds
//                                             </a>
//                                         )}
//                                     </div>
//                                 )}

//                                 {/* Active Marketplaces - Admin Only */}
//                                 {profileData?.role === 'Admin' && profileData.tenantId.activatedMarketplaces?.length > 0 && (
//                                     <div>
//                                         <div className="flex items-center justify-between mb-3">
//                                             <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
//                                                 Active Marketplaces
//                                             </label>
//                                             <a
//                                                 href="/client/settings/marketplace"
//                                                 className="px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors text-sm flex items-center gap-2"
//                                             >
//                                                 <Settings size={14} />
//                                                 Manage
//                                             </a>
//                                         </div>
//                                         <div className="flex flex-wrap gap-3">
//                                             {marketplaceGroups.map(([name, accounts]) => (
//                                                 <button
//                                                     key={name}
//                                                     onClick={() => handleOpenMarketplace(name, accounts)}
//                                                     className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-brand-400 hover:shadow-sm transition-all rounded-xl group"
//                                                     title={name}
//                                                 >
//                                                     <div className="w-8 h-8 rounded-lg flex items-center justify-center p-0.5 shrink-0">
//                                                         {getMarketplaceLogo(name) ? (
//                                                             <img
//                                                                 src={getMarketplaceLogo(name)}
//                                                                 alt={name}
//                                                                 className="w-full h-full object-contain"
//                                                             />
//                                                         ) : (
//                                                             <Building className="w-4 h-4 text-slate-400" />
//                                                         )}
//                                                     </div>
//                                                     <span className="text-xs font-semibold text-slate-700 truncate max-w-[6rem]">
//                                                         {name}
//                                                     </span>
//                                                     <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full shrink-0">
//                                                         {accounts.length}
//                                                     </span>
//                                                 </button>
//                                             ))}
//                                         </div>
//                                     </div>
//                                 )}

//                                 {/* ── Business & GST Details (Admin only) ── */}
//                                 {profileData?.role === 'Admin' && gstData !== null && (
//                                     <div className="border border-slate-200 rounded-xl overflow-hidden">
//                                         {/* Card header */}
//                                         <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
//                                             <div className="flex items-center gap-2">
//                                                 <FileText size={16} className="text-brand-600" />
//                                                 <span className="text-sm font-bold text-slate-700">Business & GST Details</span>
//                                                 <span className="text-xs text-slate-400 font-normal">— for GST invoices</span>
//                                             </div>
//                                             {!gstEditMode && (
//                                                 <button
//                                                     onClick={() => setGstEditMode(true)}
//                                                     className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg border border-brand-200 transition-colors"
//                                                 >
//                                                     <Edit size={12} />
//                                                     {gstData?.gstin ? 'Edit' : 'Add Details'}
//                                             </button>
//                                 )}
//                             </div>

//                                         {/* Read-only view */}
//                                         {!gstEditMode && (
//                                             <div className="p-4">
//                                                 {gstData?.gstin ? (
//                                                     <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
//                                                         {[
//                                                             ['Business Name', gstData.businessName],
//                                                             ['GSTIN', gstData.gstin],
//                                                             ['PAN', gstData.pan],
//                                                             ['State', gstData.state ? `${gstData.state} (${gstData.stateCode})` : '—'],
//                                                             ['Phone', gstData.phone],
//                                                             ['Address', gstData.address],
//                                                         ].map(([label, val]) => (
//                                                             <div key={label}>
//                                                                 <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
//                                                                 <p className="font-medium text-slate-700 break-words">{val || <span className="text-slate-300 italic text-xs">Not provided</span>}</p>
//                                                             </div>
//                                                         ))}
//                                                     </div>
//                                                 ) : (
//                                                     <div className="flex items-center gap-3 py-2 text-slate-400">
//                                                         <FileText size={20} className="text-slate-300" />
//                                                         <div>
//                                                             <p className="text-sm font-medium text-slate-500">No GST details added yet</p>
//                                                             <p className="text-xs text-slate-400">Add your GSTIN to generate proper tax invoices for every purchase.</p>
//                                                         </div>
//                                                     </div>
//                                                 )}
//                                             </div>
//                                         )}

//                                         {/* Edit form */}
//                                         {gstEditMode && (
//                                             <form onSubmit={handleSaveGst} className="p-4 space-y-4">
//                                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//                                                     <div>
//                                                         <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">GSTIN</label>
//                                                         <div className="flex gap-2">
//                                                             <input
//                                                                 type="text"
//                                                                 value={gstForm.gstin}
//                                                                 onChange={e => handleGstinChange(e.target.value)}
//                                                                 placeholder="e.g. 24AARFH4419D1ZH"
//                                                                 maxLength={15}
//                                                                 className={`flex-1 px-3 py-2 font-mono text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 ${gstinError ? 'border-red-300' : 'border-slate-200'}`}
//                                                             />
//                                                             <GstAutoFill
//                                                                 gstin={gstForm.gstin}
//                                                                 onGstFetched={handleProfileGstFetched}
//                                                                 disabled={!gstForm.gstin || gstForm.gstin.length < 15}
//                                                                 buttonClassName="p-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
//                                                             />
//                                                         </div>
//                                                         {gstinError
//                                                             ? <p className="text-red-500 text-xs mt-1">{gstinError}</p>
//                                                             : gstForm.gstin.length === 15 && !gstinError
//                                                             ? <p className="text-emerald-600 text-xs mt-1">✓ State & PAN auto-filled</p>
//                                                             : <p className="text-slate-400 text-xs mt-1">State & PAN will auto-fill when GSTIN is entered</p>
//                                                         }
//                                                     </div>
//                                                     <div>
//                                                         <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Business Name</label>
//                                                         <input
//                                                             type="text"
//                                                             value={gstForm.businessName}
//                                                             onChange={e => setGstForm(f => ({ ...f, businessName: e.target.value }))}
//                                                             placeholder="e.g. Hmsquare Solutions LLP"
//                                                             className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
//                                                         />
//                                                     </div>
//                                                     <div>
//                                                         <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">PAN <span className="normal-case font-normal text-slate-400">(auto from GSTIN)</span></label>
//                                                         <input
//                                                             type="text"
//                                                             value={gstForm.pan}
//                                                             onChange={e => setGstForm(f => ({ ...f, pan: e.target.value.toUpperCase() }))}
//                                                             placeholder="e.g. AARFH4419D"
//                                                             maxLength={10}
//                                                             className="w-full px-3 py-2 font-mono text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
//                                                         />
//                                                     </div>
//                                                     <div>
//                                                         <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">State <span className="normal-case font-normal text-slate-400">(auto from GSTIN)</span></label>
//                                                         <input
//                                                             type="text"
//                                                             value={gstForm.state}
//                                                             onChange={e => setGstForm(f => ({ ...f, state: e.target.value }))}
//                                                             placeholder="e.g. Gujarat"
//                                                             className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
//                                                         />
//                                                     </div>
//                                                     <div>
//                                                         <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Phone</label>
//                                                         <input
//                                                             type="tel"
//                                                             value={gstForm.phone}
//                                                             onChange={e => setGstForm(f => ({ ...f, phone: e.target.value }))}
//                                                             placeholder="e.g. 9913315809"
//                                                             className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
//                                                         />
//                                                     </div>
//                                                     <div className="md:col-span-2">
//                                                         <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Address</label>
//                                                         <textarea
//                                                             value={gstForm.address}
//                                                             onChange={e => setGstForm(f => ({ ...f, address: e.target.value }))}
//                                                             placeholder="Full billing address as it should appear on invoices"
//                                                             rows={2}
//                                                             className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
//                                                         />
//                                                     </div>
//                                                 </div>
//                                                 <div className="flex gap-3 pt-2 border-t border-slate-100">
//                                                     <button
//                                                         type="submit"
//                                                         disabled={savingGst || !!gstinError}
//                                                         className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
//                                                     >
//                                                         <Save size={14} />
//                                                         {savingGst ? 'Saving…' : 'Save GST Details'}
//                                                     </button>
//                                                     <button
//                                                         type="button"
//                                                         onClick={() => { setGstEditMode(false); setGstinError(''); setGstForm({ businessName: gstData?.businessName || '', gstin: gstData?.gstin || '', pan: gstData?.pan || '', address: gstData?.address || '', state: gstData?.state || '', stateCode: gstData?.stateCode || '', phone: gstData?.phone || '' }); }}
//                                                         className="flex items-center gap-2 px-5 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors"
//                                                     >
//                                                         <X size={14} />
//                                                         Cancel
//                                                     </button>
//                                                 </div>
//                                             </form>
//                                         )}
//                                     </div>
//                                 )}

//                                 {/* Account Status */}
//                                 <div>
//                                     <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
//                                         Tenant Status
//                                     </label>
//                                     <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${profileData.tenantId.isApproved
//                                         ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
//                                         : 'bg-amber-50 text-amber-700 border border-amber-200'
//                                         }`}>
//                                         <CheckCircle size={14} />
//                                         {profileData.tenantId.isApproved ? 'Approved' : 'Pending Approval'}
//                                     </span>
//                                 </div>
//                             </div>
//                         </div>
//                     )}

//                     {/* Marketplace Accounts Popup */}
//                     {selectedMarketplace && (
//                         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setSelectedMarketplace(null)}>
//                             <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
//                                 <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
//                                     <div className="flex items-center gap-3">
//                                         <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center p-1.5 border border-slate-100">
//                                             {getMarketplaceLogo(selectedMarketplace.name) ? (
//                                                 <img src={getMarketplaceLogo(selectedMarketplace.name)} alt={selectedMarketplace.name} className="w-full h-full object-contain" />
//                                             ) : (
//                                                 <Building className="w-5 h-5 text-slate-400" />
//                                             )}
//                                         </div>
//                                         <div>
//                                             <h3 className="font-semibold text-slate-800">{selectedMarketplace.name}</h3>
//                                             <p className="text-xs text-slate-500">{selectedMarketplace.accounts.length} account{selectedMarketplace.accounts.length > 1 ? 's' : ''}</p>
//                                         </div>
//                                     </div>
//                                     <button onClick={() => setSelectedMarketplace(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
//                                         <X size={18} className="text-slate-400" />
//                                     </button>
//                                 </div>
//                                 <div className="px-6 py-4 space-y-2 max-h-60 overflow-y-auto">
//                                     {selectedMarketplace.accounts.map((acc, idx) => (
//                                         <div key={idx} className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
//                                             <div className="flex items-center gap-3">
//                                                 <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
//                                                     <CheckCircle size={14} className="text-emerald-600" />
//                                                 </div>
//                                                 <span className="text-sm font-medium text-slate-700">{acc.accountName || acc.name || 'Account'}</span>
//                                             </div>
//                                             <p className="text-xs text-slate-500 mt-1 ml-9">
//                                                 {acc.email || (acc.signInType === 'phone' ? acc.phone : 'OAuth API')}
//                                             </p>
//                                             {acc.analysisStartDate && (
//                                                 <p className="text-[11px] text-brand-600 font-medium mt-0.5 ml-9">
//                                                     Analysis Start Date: {new Date(acc.analysisStartDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
//                                                 </p>
//                                             )}
//                                         </div>
//                                     ))}
//                                 </div>
//                             </div>
//                         </div>
//                     )}

//                     {activeTab === 'credits' && !['SuperAdmin', 'SBM', 'RM'].includes(profileData?.role) && (contextUser?.permissions?.creditUsage ?? true) && (
//                         <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
//                             <div className="flex justify-end mb-5">
//                                 <ViewToggle
//                                     view={creditsViewMode}
//                                     onViewChange={setCreditsViewMode}
//                                     gridLabel="Reconciliation Month"
//                                     listLabel="Billing Month"
//                                 />
//                             </div>
//                             <CreditsTab tenantId={profileData?.tenantId?._id} viewMode={creditsViewMode} />
//                         </div>
//                     )}

//                     {activeTab === 'system-settings' && profileData?.role === 'SuperAdmin' && (
//                         <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
//                             {settingsLoading ? (
//                                 <div className="flex flex-col items-center justify-center min-h-[200px]">
//                                     <Loader2 className="animate-spin text-brand-600 mb-4" size={32} />
//                                     <p className="text-sm text-slate-500">Loading system settings...</p>
//                                 </div>
//                             ) : (
//                                 <div className="space-y-5">
//                                     <div className="flex items-start gap-2.5">
//                                         <div className="p-2 bg-brand-50 rounded-lg text-brand-600 border border-brand-100">
//                                             <Settings size={15} />
//                                         </div>
//                                         <div>
//                                             <h3 className="font-bold text-slate-800 text-sm">Sequence Settings</h3>
//                                             <p className="text-xs text-slate-500 mt-0.5">
//                                                 Configure the next auto-assigned IDs for tenants and invoices.
//                                             </p>
//                                         </div>
//                                     </div>

//                                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
//                                         <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
//                                             <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
//                                                 Next auto-assigned tenant ID
//                                             </label>
//                                             <div className="flex items-center gap-1.5 font-mono bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm w-fit">
//                                                 <Hash size={13} className="text-[#1a2c5e]/50 shrink-0" />
//                                                 <span className="text-base font-bold text-[#1a2c5e] tracking-wide">{systemSettings.nextTenantId}</span>
//                                             </div>
//                                             <p className="text-xs text-slate-400 mt-1.5">
//                                                 The next approved tenant will receive this ID. Read-only.
//                                             </p>
//                                         </div>

//                                         <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
//                                             <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
//                                                 Next invoice number
//                                             </label>
//                                             <div className="flex items-center gap-3">
//                                                 <div className="flex items-center gap-1.5 font-mono bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-sm">
//                                                     <FileText size={14} className="text-[#1a2c5e]/40 shrink-0" />
//                                                     <span className="text-sm text-slate-400 select-none">{nextInvoiceNumber ? nextInvoiceNumber.replace(/\/(\d+)$/, '/') : '—'}</span>
//                                                     <input
//                                                         type="number"
//                                                         min="0"
//                                                         value={invoiceSeqDraft}
//                                                         onChange={e => setInvoiceSeqDraft(e.target.value)}
//                                                         onKeyDown={e => { if (e.key === 'Enter') handleSaveInvoiceSequence(); }}
//                                                         className="w-20 px-1.5 py-0.5 text-sm font-bold text-[#1a2c5e] bg-white border border-[#1a2c5e]/20 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a2c5e]/20 focus:border-[#1a2c5e]/40 transition-all text-center"
//                                                         placeholder="0"
//                                                     />
//                                                 </div>
//                                                 <button
//                                                     onClick={handleSaveInvoiceSequence}
//                                                     disabled={savingSeq}
//                                                     className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#1a2c5e] text-white text-xs font-semibold rounded-lg hover:bg-[#0f1a3d] active:scale-95 transition-all disabled:opacity-60 shadow-sm"
//                                                 >
//                                                     <Save size={13} />
//                                                     {savingSeq ? 'Saving...' : 'Set'}
//                                                 </button>
//                                             </div>
//                                             <p className="text-[11px] text-slate-400 mt-2">
//                                                 Sets the sequence for the next manually created invoice. The prefix and financial year are fixed.
//                                             </p>
//                                         </div>
//                                     </div>

//                                 </div>
//                             )}
//                         </div>
//                     )}
//                 </div>
//                 {/* Password Change Modal */}
//                 {isPasswordModalOpen && (
//                     <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
//                         <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
//                             {/* Modal Header */}
//                             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
//                                 <div className="flex items-center gap-3">
//                                     <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
//                                         <Lock className="text-amber-600" size={20} />
//                                     </div>
//                                     <div>
//                                         <h3 className="font-bold text-lg text-slate-800">Change Password</h3>
//                                         <p className="text-xs text-slate-500">Update your account password</p>
//                                     </div>
//                                 </div>
//                                 <button
//                                     onClick={closePasswordModal}
//                                     className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-200 rounded-lg"
//                                 >
//                                     <X size={20} />
//                                 </button>
//                             </div>

//                             {/* Modal Body */}
//                             <form onSubmit={handleChangePassword} className="p-6 space-y-4">
//                                 {/* Current Password */}
//                                 <div>
//                                     <label className="block text-sm font-medium text-slate-700 mb-2">
//                                         Current Password
//                                     </label>
//                                     <div className="relative">
//                                         <input
//                                             type={showCurrentPassword ? 'text' : 'password'}
//                                             value={currentPassword}
//                                             onChange={(e) => setCurrentPassword(e.target.value)}
//                                             className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all pr-10"
//                                             placeholder="Enter current password"
//                                             required
//                                         />
//                                         <button
//                                             type="button"
//                                             onClick={() => setShowCurrentPassword(!showCurrentPassword)}
//                                             className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
//                                         >
//                                             {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
//                                         </button>
//                                     </div>
//                                 </div>

//                                 {/* New Password */}
//                                 <div>
//                                     <label className="block text-sm font-medium text-slate-700 mb-2">
//                                         New Password
//                                     </label>
//                                     <div className="relative">
//                                         <input
//                                             type={showNewPassword ? 'text' : 'password'}
//                                             value={newPassword}
//                                             onChange={(e) => setNewPassword(e.target.value)}
//                                             className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all pr-10"
//                                             placeholder="Enter new password"
//                                             required
//                                         />
//                                         <button
//                                             type="button"
//                                             onClick={() => setShowNewPassword(!showNewPassword)}
//                                             className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
//                                         >
//                                             {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
//                                         </button>
//                                     </div>
//                                     {newPassword && (
//                                         <div className="mt-2">
//                                             <div className="flex justify-between items-center mb-1">
//                                                 <span className="text-xs text-slate-500">Password Strength:</span>
//                                                 <span className={`text-xs font-medium ${passwordStrength <= 25 ? 'text-red-600' :
//                                                     passwordStrength <= 50 ? 'text-orange-600' :
//                                                         passwordStrength <= 75 ? 'text-yellow-600' :
//                                                             'text-green-600'
//                                                     }`}>
//                                                     {getPasswordStrengthText()}
//                                                 </span>
//                                             </div>
//                                             <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
//                                                 <div
//                                                     className={`h-full ${getPasswordStrengthColor()} transition-all duration-300`}
//                                                     style={{ width: `${passwordStrength}%` }}
//                                                 ></div>
//                                             </div>
//                                         </div>
//                                     )}
//                                 </div>

//                                 {/* Confirm Password */}
//                                 <div>
//                                     <label className="block text-sm font-medium text-slate-700 mb-2">
//                                         Confirm New Password
//                                     </label>
//                                     <div className="relative">
//                                         <input
//                                             type={showConfirmPassword ? 'text' : 'password'}
//                                             value={confirmPassword}
//                                             onChange={(e) => setConfirmPassword(e.target.value)}
//                                             className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all pr-10"
//                                             placeholder="Confirm new password"
//                                             required
//                                         />
//                                         <button
//                                             type="button"
//                                             onClick={() => setShowConfirmPassword(!showConfirmPassword)}
//                                             className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
//                                         >
//                                             {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
//                                         </button>
//                                     </div>
//                                     {confirmPassword && newPassword && (
//                                         <p className={`text-xs mt-1 ${confirmPassword === newPassword ? 'text-green-600' : 'text-red-600'
//                                             }`}>
//                                             {confirmPassword === newPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
//                                         </p>
//                                     )}
//                                 </div>

//                                 {/* Password Requirements */}
//                                 <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
//                                     <p className="text-xs font-medium text-slate-700 mb-2">Password must contain:</p>
//                                     <ul className="text-xs text-slate-500 space-y-1">
//                                         <li className="flex items-center gap-1.5">
//                                             <span className={newPassword.length >= 8 ? 'text-green-600' : 'text-slate-400'}>
//                                                 {newPassword.length >= 8 ? '✓' : '○'}
//                                             </span>
//                                             At least 8 characters
//                                         </li>
//                                         <li className="flex items-center gap-1.5">
//                                             <span className={/[A-Z]/.test(newPassword) ? 'text-green-600' : 'text-slate-400'}>
//                                                 {/[A-Z]/.test(newPassword) ? '✓' : '○'}
//                                             </span>
//                                             One uppercase letter
//                                         </li>
//                                         <li className="flex items-center gap-1.5">
//                                             <span className={/[a-z]/.test(newPassword) ? 'text-green-600' : 'text-slate-400'}>
//                                                 {/[a-z]/.test(newPassword) ? '✓' : '○'}
//                                             </span>
//                                             One lowercase letter
//                                         </li>
//                                         <li className="flex items-center gap-1.5">
//                                             <span className={/\d/.test(newPassword) ? 'text-green-600' : 'text-slate-400'}>
//                                                 {/\d/.test(newPassword) ? '✓' : '○'}
//                                             </span>
//                                             One number
//                                         </li>
//                                     </ul>
//                                 </div>

//                                 {/* Modal Actions */}
//                                 <div className="pt-2 flex gap-3">
//                                     <button
//                                         type="button"
//                                         onClick={closePasswordModal}
//                                         className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
//                                     >
//                                         Cancel
//                                     </button>
//                                     <button
//                                         type="submit"
//                                         disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
//                                         className="flex-1 py-2.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-500/20"
//                                     >
//                                         {changingPassword ? 'Updating...' : 'Update Password'}
//                                     </button>
//                                 </div>
//                             </form>
//                         </div>
//                     </div>
//                 )}

//                 {/* Logout Confirmation Modal */}
//                 {isLogoutModalOpen && (
//                     <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
//                         <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 animate-in fade-in zoom-in duration-200">
//                             {/* Modal Header */}
//                             <div className="flex items-center justify-between p-6 border-b border-slate-200">
//                                 <div className="flex items-center gap-3">
//                                     <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
//                                         <LogOut className="text-amber-600" size={20} />
//                                     </div>
//                                     <div>
//                                         <h3 className="font-bold text-lg text-slate-800">Sign Out</h3>
//                                         <p className="text-xs text-slate-500">Confirm your action</p>
//                                     </div>
//                                 </div>
//                                 <button
//                                     onClick={cancelLogout}
//                                     className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-200 rounded-lg"
//                                 >
//                                     <X size={20} />
//                                 </button>
//                             </div>

//                             {/* Modal Body */}
//                             <div className="p-6 space-y-4">
//                                 <p className="text-slate-600 text-sm">
//                                     Are you sure you want to sign out? You'll need to log in again to access your account.
//                                 </p>

//                                 {/* Don't Ask Again Checkbox */}
//                                 <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
//                                     <input
//                                         type="checkbox"
//                                         id="dontAskAgain"
//                                         checked={dontAskAgain}
//                                         onChange={(e) => setDontAskAgain(e.target.checked)}
//                                         className="mt-0.5 w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
//                                     />
//                                     <label htmlFor="dontAskAgain" className="text-sm text-slate-600 cursor-pointer select-none">
//                                         Don't ask me again
//                                         <span className="block text-xs text-slate-500 mt-0.5">
//                                             You can re-enable this in settings
//                                         </span>
//                                     </label>
//                                 </div>

//                                 {/* Modal Actions */}
//                                 <div className="pt-2 flex gap-3">
//                                     <button
//                                         type="button"
//                                         onClick={cancelLogout}
//                                         className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
//                                     >
//                                         Cancel
//                                     </button>
//                                     <button
//                                         type="button"
//                                         onClick={confirmLogout}
//                                         className="flex-1 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
//                                     >
//                                         Yes, Sign Out
//                                     </button>
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                 )}
//                 </div>
//                 </main>
//             </div>
//         </DashboardLayout>
//     );
// };

// export default ProfileSettings;

import React, { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import api, { encryptPassword } from '../api';
import CreditsTab from '../components/dashboard/CreditsTab';
import ViewToggle from '../components/ViewToggle';
import { User, Lock, Building, CreditCard, CheckCircle, Eye, EyeOff, ShieldCheck, Calendar, X, LogOut, Edit, Check, Plus, Settings, Camera, FileText, Save, Loader2, Hash } from 'lucide-react';
import { parseGstin } from '../utils/gstinUtils';
import GstAutoFill from '../components/GstAutoFill';
import { toast } from 'sonner';
import { getMarketplaceLogo } from '../utils/marketplaceLogos';
import { formatTenantLabel } from '../utils/tenantDisplay';

const ProfileSettings = () => {
    const { user: contextUser, updateUserInContext, logout, isImpersonating } = useAuth();
    const [loading, setLoading] = useState(true);
    const [profileData, setProfileData] = useState(null);


    // Tab state
    const [activeTab, setActiveTab] = useState('personal');
    const [creditsViewMode, setCreditsViewMode] = useState(() => localStorage.getItem('profileCreditsViewMode') || 'grid');

    // Profile update state
    const [fullName, setFullName] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    // Marketplace popup state
    const [selectedMarketplace, setSelectedMarketplace] = useState(null);

    const handleOpenMarketplace = async (name, accounts) => {
        try {
            const { data: res } = await api.get('/marketplaces');
            const groups = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            const accMap = {};
            groups.forEach(g => (g.accounts || []).forEach(a => { accMap[a._id] = a; }));
            const enriched = accounts.map(acc => {
                const full = accMap[acc.marketplaceId] || {};
                return { ...acc, ...full };
            });
            setSelectedMarketplace({ name, accounts: enriched });
        } catch {
            setSelectedMarketplace({ name, accounts });
        }
    };

    // Password modal state
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    // Logout modal state
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [dontAskAgain, setDontAskAgain] = useState(false);

    // Live balance state (fetched fresh on org tab)
    const [liveBalance, setLiveBalance] = useState(null);

    // GST details state (Admin only)
    const [gstData, setGstData] = useState(null);   // null = not loaded yet
    const [gstEditMode, setGstEditMode] = useState(false);
    const [gstForm, setGstForm] = useState({ businessName: '', gstin: '', pan: '', address: '', state: '', stateCode: '', phone: '' });
    const [savingGst, setSavingGst] = useState(false);
    const [gstinError, setGstinError] = useState('');
    const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);

    // System Settings state (SuperAdmin)
    const [systemSettings, setSystemSettings] = useState({ nextTenantId: 1000 });
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [nextInvoiceNumber, setNextInvoiceNumber] = useState('');
    const [invoiceSeqDraft, setInvoiceSeqDraft] = useState('');
    const [savingSeq, setSavingSeq] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        calculatePasswordStrength(newPassword);
    }, [newPassword]);

    useEffect(() => {
        localStorage.setItem('profileCreditsViewMode', creditsViewMode);
    }, [creditsViewMode]);

    // Reset tab if active tab permission is revoked
    useEffect(() => {
        if (activeTab === 'credits' && !(contextUser?.permissions?.creditUsage ?? true)) {
            setActiveTab('personal');
        }
    }, [contextUser?.permissions?.creditUsage, activeTab]);

    // Fetch live balance when org tab is active
    useEffect(() => {
        if (activeTab === 'organization' && profileData?.tenantId?._id) {
            api.get(`/credits/balance?tenantId=${profileData.tenantId._id}`)
                .then(res => setLiveBalance(res.data?.billedBalance ?? null))
                .catch(() => { });
        }
    }, [activeTab, profileData?.tenantId?._id]);

    const fetchProfile = async () => {
        try {
            const { data } = await api.get('/auth/profile');
            setProfileData(data);
            console.log("🚀 ~ fetchProfile ~ data:", data)
            setFullName(data.fullName);
            setMobileNumber(data.mobileNumber || '');
            // Load GST details for Admin
            if (data.role === 'Admin') {
                try {
                    const { data: gst } = await api.get('/auth/gst-details');
                    setGstData(gst || {});
                    setGstForm({
                        businessName: gst?.businessName || '',
                        gstin: gst?.gstin || '',
                        pan: gst?.pan || '',
                        address: gst?.address || '',
                        state: gst?.state || '',
                        stateCode: gst?.stateCode || '',
                        phone: gst?.phone || '',
                    });
                } catch { setGstData({}); }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            toast.error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const fetchSystemSettings = async () => {
        setSettingsLoading(true);
        try {
            const res = await api.get('/superadmin/settings');
            const data = res.data;
            setSystemSettings({ nextTenantId: data.nextTenantId ?? 1000 });
            setNextInvoiceNumber(data.nextInvoiceNumber || '');
            setInvoiceSeqDraft(String(data.nextInvoiceSequence ?? ''));
        } catch (error) {
            console.error('Error fetching system settings:', error);
        } finally {
            setSettingsLoading(false);
        }
    };

    useEffect(() => {
        if (contextUser?.role === 'SuperAdmin') {
            fetchSystemSettings();
        }
    }, [contextUser?.role]);

    const handleSaveInvoiceSequence = async () => {
        const seq = parseInt(invoiceSeqDraft, 10);
        if (isNaN(seq) || seq < 1) {
            toast.error('Enter a valid invoice sequence number');
            return;
        }
        setSavingSeq(true);
        try {
            const res = await api.put('/superadmin/settings', { nextInvoiceSequence: seq });
            const data = res.data;
            setNextInvoiceNumber(data.nextInvoiceNumber || '');
            setInvoiceSeqDraft(String(data.nextInvoiceSequence ?? ''));
            toast.success('Invoice sequence updated');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to update invoice sequence');
        } finally {
            setSavingSeq(false);
        }
    };

    const handleGstinChange = (value) => {
        const g = value.toUpperCase();
        setGstForm(f => ({ ...f, gstin: g }));
        setGstinError('');
        if (g.length === 15) {
            if (!GSTIN_RE.test(g)) { setGstinError('Invalid GSTIN format'); return; }
            const parsed = parseGstin(g);
            if (parsed.valid) {
                setGstForm(f => ({
                    ...f,
                    gstin: g,
                    pan: parsed.pan,
                    state: parsed.stateName || f.state,
                    stateCode: parsed.stateCode,
                }));
            }
        }
    };

    const handleProfileGstFetched = (data) => {
        setGstForm(f => ({
            ...f,
            businessName: data.businessName || f.businessName,
            address: data.address || f.address,
            pan: data.pan || f.pan,
            state: data.state || f.state,
            stateCode: data.stateCode || f.stateCode,
        }));
    };

    const handleSaveGst = async (e) => {
        e.preventDefault();
        if (gstForm.gstin && !GSTIN_RE.test(gstForm.gstin)) { setGstinError('Invalid GSTIN format'); return; }
        setSavingGst(true);
        try {
            const { data } = await api.put('/auth/gst-details', gstForm);
            setGstData(data);
            setGstEditMode(false);
            toast.success('Business & GST details saved');
        } catch { /* handled by interceptor */ }
        finally { setSavingGst(false); }
    };

    const calculatePasswordStrength = (password) => {
        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (password.length >= 12) strength += 25;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
        if (/\d/.test(password)) strength += 25;
        setPasswordStrength(strength);
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();

        if (!fullName || fullName.trim().length < 2) {
            toast.error('Full name must be at least 2 characters');
            return;
        }

        if (fullName.length > 50) {
            toast.error('Full name must not exceed 50 characters');
            return;
        }

        // Validate mobile number if provided
        if (mobileNumber && mobileNumber.trim()) {
            const cleaned = mobileNumber.replace(/[\s-]/g, '');
            const mobileRegex = /^(\+91)?[6-9]\d{9}$/;
            if (!mobileRegex.test(cleaned)) {
                toast.error('Invalid mobile number. Use +91XXXXXXXXXX or 10 digits starting with 6-9');
                return;
            }
        }

        setSavingProfile(true);
        try {
            const { data } = await api.put('/auth/profile', {
                fullName: fullName.trim(),
                mobileNumber: mobileNumber.trim() || undefined
            });
            setProfileData(data);
            toast.success('Profile updated successfully');
            setIsEditMode(false); // Exit edit mode

            // Update context
            if (updateUserInContext) {
                updateUserInContext({ fullName: data.fullName });
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            // Error toast is handled by global interceptor
        } finally {
            setSavingProfile(false);
        }
    };

    // Function to handle file selection and upload
    const handlePhotoChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        // Validation
        if (file.size > 2 * 1024 * 1024) { // 2MB
            toast.error('Image size should be less than 2MB');
            return;
        }
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file');
            return;
        }
        try {
            setUploadingPhoto(true);
            // Get Signed URL
            const { data: { uploadUrl, key } } = await api.get(`/auth/profile/upload-url?fileType=${file.type}`);
            // Upload to GCS
            await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type,
                },
            });
            // Update Profile with new Image Key/URL 
            const gcsBaseUrl = `https://storage.googleapis.com/speedecom_stage`;
            const finalImageUrl = `${gcsBaseUrl}/${key}`;

            // Update User Profile in DB
            const { data: updatedUser } = await api.put('/auth/profile', {
                fullName: profileData.fullName, // Keep existing name
                profilePicture: finalImageUrl
            });
            setProfileData(updatedUser);
            if (updateUserInContext) updateUserInContext(updatedUser);

            toast.success('Profile picture updated successfully');
        } catch (error) {
            console.error('Photo upload error:', error);
            toast.error('Failed to upload profile picture');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();

        // Validation
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error('All password fields are required');
            return;
        }

        if (newPassword.length < 8) {
            toast.error('New password must be at least 8 characters');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        if (currentPassword === newPassword) {
            toast.error('New password must be different from current password');
            return;
        }

        setChangingPassword(true);
        try {
            const encryptedCurrent = await encryptPassword(currentPassword);
            const encryptedNew = await encryptPassword(newPassword);

            await api.put('/auth/change-password', {
                currentPassword: encryptedCurrent,
                newPassword: encryptedNew
            });

            toast.success('Password changed successfully');

            // Clear form and close modal
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setPasswordStrength(0);
            setIsPasswordModalOpen(false);
        } catch (error) {
            console.error('Error changing password:', error);
            // Error toast is handled by global interceptor
        } finally {
            setChangingPassword(false);
        }
    };

    const closePasswordModal = () => {
        setIsPasswordModalOpen(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordStrength(0);
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
    };

    const handleSignOut = () => {
        // Check if user has disabled confirmation
        const skipConfirmation = localStorage.getItem('skipLogoutConfirmation') === 'true';

        if (skipConfirmation) {
            logout();
        } else {
            setIsLogoutModalOpen(true);
        }
    };

    const confirmLogout = () => {
        // Save preference if checkbox is checked
        if (dontAskAgain) {
            localStorage.setItem('skipLogoutConfirmation', 'true');
        }

        setIsLogoutModalOpen(false);
        logout();
    };

    const cancelLogout = () => {
        setIsLogoutModalOpen(false);
        setDontAskAgain(false);
    };


    const handleEditMode = () => {
        setIsEditMode(true);
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
        setFullName(profileData?.fullName);
        setMobileNumber(profileData?.mobileNumber || '');
    };

    const getPasswordStrengthColor = () => {
        if (passwordStrength <= 25) return 'bg-red-500';
        if (passwordStrength <= 50) return 'bg-orange-500';
        if (passwordStrength <= 75) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getPasswordStrengthText = () => {
        if (passwordStrength <= 25) return 'Weak';
        if (passwordStrength <= 50) return 'Fair';
        if (passwordStrength <= 75) return 'Good';
        return 'Strong';
    };

    const marketplaceGroups = useMemo(() => {
        const groups = {};
        (profileData?.tenantId?.activatedMarketplaces || []).forEach(mp => {
            const key = mp.marketplaceName || mp.name || 'Unknown';
            if (!groups[key]) groups[key] = [];
            groups[key].push(mp);
        });
        return Object.entries(groups);
    }, [profileData?.tenantId?.activatedMarketplaces]);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="w-full flex flex-col h-full overflow-hidden bg-slate-50">
                {/* Header */}
                <header className="bg-slate-50 backdrop-blur-md sticky top-0 z-10 px-8 py-3 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-heading font-bold text-slate-800">
                                Profile Settings
                            </h2>
                            {profileData?.tenantId && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1  border border-brand-200/60 text-brand-700 rounded-xl text-md  font-bold shadow-xs">

                                    {formatTenantLabel(profileData.tenantId)}
                                </span>
                            )}
                        </div>
                    </div>
                    {!isImpersonating && (
                        <button
                            onClick={handleSignOut}
                            className="px-4 py-2 border-2 border-red-200 text-red-600 font-medium rounded-xl hover:bg-red-50 hover:border-red-300 transition-all flex items-center gap-2 shadow-sm text-sm"
                        >
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    )}
                </header>

                <main className="flex-1 w-full flex flex-col overflow-hidden relative">
                    {/* Tab Navigation */}
                    <div className="z-10 bg-slate-50/90 backdrop-blur-md pt-2 pb-3 px-4 md:px-8 border-b border-slate-200/40 shadow-[0_8px_16px_-6px_rgba(0,0,0,0.05)] shrink-0">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center p-1.5 bg-slate-100/80 rounded-2xl overflow-x-auto custom-scrollbar w-full md:w-auto shadow-sm">
                                <button
                                    onClick={() => setActiveTab('personal')}
                                    className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'personal'
                                        ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                        }`}
                                >
                                    Personal Details
                                </button>

                                {profileData?.tenantId && (
                                    <button
                                        onClick={() => setActiveTab('organization')}
                                        className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'organization'
                                            ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                            }`}
                                    >
                                        Organization
                                    </button>
                                )}

                                {!['SuperAdmin', 'SBM', 'RM'].includes(profileData?.role) && (contextUser?.permissions?.creditUsage ?? true) && (
                                    <button
                                        onClick={() => setActiveTab('credits')}
                                        className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'credits'
                                            ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                            }`}
                                    >
                                        Credit & Usage
                                    </button>
                                )}
                                {profileData?.role === 'SuperAdmin' && (
                                    <button
                                        onClick={() => setActiveTab('system-settings')}
                                        className={`px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap ${activeTab === 'system-settings'
                                            ? 'bg-white text-brand-700 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] ring-1 ring-slate-200/50'
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                            }`}
                                    >
                                        System Settings
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-gradient-to-br from-gray-50 to-slate-100/80">

                        {/* Tab Content */}
                        <div>
                            {activeTab === 'personal' && (
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                    {/* Avatar Section with Edit Button */}
                                    <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="relative group">
                                                {/* Avatar Image or Initials */}
                                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-brand-500/20 overflow-hidden">
                                                    {profileData?.profilePicture ? (
                                                        <img src={profileData.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                                                    ) : (
                                                        profileData?.fullName?.charAt(0)?.toUpperCase() || 'U'
                                                    )}
                                                </div>
                                                {/* Upload Overlay Button */}
                                                {!isImpersonating && (
                                                    <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
                                                        {uploadingPhoto ? (
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                        ) : (
                                                            <Camera size={18} className="text-white" />
                                                        )}
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            accept="image/*"
                                                            onChange={handlePhotoChange}
                                                            disabled={uploadingPhoto}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-lg font-semibold text-slate-700">{profileData?.fullName}</p>
                                                <p className="text-sm text-slate-500 mt-1">{profileData?.email}</p>
                                            </div>
                                        </div>
                                        {!isEditMode && !isImpersonating && (
                                            <button
                                                onClick={handleEditMode}
                                                className="px-4 py-2 bg-brand-50 text-brand-600 font-medium rounded-xl hover:bg-brand-100 transition-colors flex items-center gap-2 border border-brand-200"
                                            >
                                                <Edit size={16} />
                                                Edit
                                            </button>
                                        )}
                                    </div>

                                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Full Name */}
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                                                    Full Name
                                                </label>
                                                {isEditMode ? (
                                                    <input
                                                        type="text"
                                                        value={fullName}
                                                        onChange={(e) => setFullName(e.target.value)}
                                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                                                        placeholder="Enter your full name"
                                                        required
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <p className="text-base font-medium text-slate-80">{profileData?.fullName}</p>
                                                )}
                                            </div>

                                            {/* Mobile Number */}
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                                                    Mobile Number
                                                </label>
                                                {isEditMode ? (
                                                    <>
                                                        <input
                                                            type="tel"
                                                            value={mobileNumber}
                                                            onChange={(e) => setMobileNumber(e.target.value)}
                                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                                                            placeholder="+91XXXXXXXXXX"
                                                            pattern="(\+91)?[6-9]\d{9}"
                                                        />
                                                    </>
                                                ) : (
                                                    <p className="text-base font-medium text-slate-800 ">
                                                        {profileData?.mobileNumber || <span className="text-slate-400 italic">Not provided</span>}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Email (Read-only) */}
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                                                    Email Address
                                                </label>
                                                <div className="flex items-center gap-2 ">
                                                    <p className="text-base font-medium text-slate-600">{profileData?.email}</p>
                                                    <Lock className="text-slate-400" size={14} />
                                                </div>
                                                <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
                                            </div>

                                            {/* Role Badge */}
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Role</label>
                                                <div className="flex items-center gap-2 ">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${profileData?.role === 'SuperAdmin'
                                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                        : profileData?.role === 'Admin'
                                                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                            : 'bg-slate-50 text-slate-700 border border-slate-200'
                                                        }`}>
                                                        <ShieldCheck size={14} />
                                                        {profileData?.role}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Account Status */}
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Account Status</label>
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${profileData?.isApproved
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}>
                                                        <CheckCircle size={14} />
                                                        {profileData?.isApproved ? 'Approved' : 'Pending Approval'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Member Since */}
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Member Since</label>
                                                <div className="flex items-center gap-2 text-base font-medium text-slate-800">
                                                    <Calendar size={16} className="text-slate-400" />
                                                    {new Date(profileData?.createdAt).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons - Show only in edit mode */}
                                        {isEditMode && (
                                            <div className="flex gap-3 pt-6 border-t border-slate-100">
                                                <button
                                                    type="submit"
                                                    disabled={savingProfile || (fullName === profileData?.fullName && mobileNumber === (profileData?.mobileNumber || ''))}
                                                    className="px-6 py-2.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-500/20 flex items-center gap-2"
                                                >
                                                    <Check size={18} />
                                                    {savingProfile ? 'Saving...' : 'Save Changes'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEdit}
                                                    disabled={savingProfile}
                                                    className="px-6 py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-2"
                                                >
                                                    <X size={18} />
                                                    Cancel
                                                </button>
                                            </div>
                                        )}

                                        {/* Change Password Button - Always visible */}
                                        <div className="pt-6 border-t border-slate-100">
                                            <button
                                                type="button"
                                                onClick={() => setIsPasswordModalOpen(true)}
                                                className="px-6 py-2.5 bg-amber-50 text-amber-700 font-medium rounded-xl hover:bg-amber-100 transition-colors border border-amber-200 flex items-center gap-2"
                                            >
                                                <Lock size={16} />
                                                Change Password
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {activeTab === 'organization' && profileData?.tenantId && (
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                    <div className="flex items-center justify-between pb-6 border-b border-slate-100 mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
                                                <Building className="text-indigo-600" size={20} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                    Organization Name
                                                </label>
                                                <p className="text-lg font-semibold text-slate-800">{profileData.tenantId.name}</p>
                                            </div>
                                        </div>

                                        {(profileData.tenantId.tenantId != null || profileData.tenantId._id) && (
                                            <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl flex items-center gap-2.5">
                                                {/* <div className="w-7 h-7 rounded-lg bg-slate-200/70 flex items-center justify-center text-slate-600">
                                                    <Hash size={15} />
                                                </div> */}
                                                <div>
                                                    {/* <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        Tenant ID
                                                    </label> */}
                                                    <p className="text-sm font-bold text-slate-800 font-mono">
                                                        {formatTenantLabel(profileData.tenantId)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-6">

                                        {/* Current Balance - Admin Only */}
                                        {profileData?.role === 'Admin' && (
                                            <div className="bg-brand-50 rounded-xl px-4 py-3 border border-brand-100 flex justify-between items-center">
                                                <div className="flex-col items-between h-full">
                                                    <label className="block text-xs font-medium text-brand-700 uppercase tracking-wider mb-2">
                                                        Available Balance
                                                    </label>
                                                    <div className="flex items-center gap-3">
                                                        <CreditCard className="text-brand-600" size={24} />
                                                        <span className="text-3xl font-bold text-brand-600">
                                                            {(liveBalance ?? profileData?.tenantId?.billedBalance ?? 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>

                                                {!isImpersonating && (
                                                    <a
                                                        href="/client/subscription"
                                                        className="px-4 h-10 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20 text-sm flex items-center gap-2"
                                                    >
                                                        <Plus size={16} />
                                                        Add Funds
                                                    </a>
                                                )}
                                            </div>
                                        )}

                                        {/* Active Marketplaces - Admin Only */}
                                        {profileData?.role === 'Admin' && profileData.tenantId.activatedMarketplaces?.length > 0 && (
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                        Active Marketplaces
                                                    </label>
                                                    <a
                                                        href="/client/settings/marketplace"
                                                        className="px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors text-sm flex items-center gap-2"
                                                    >
                                                        <Settings size={14} />
                                                        Manage
                                                    </a>
                                                </div>
                                                <div className="flex flex-wrap gap-3">
                                                    {marketplaceGroups.map(([name, accounts]) => (
                                                        <button
                                                            key={name}
                                                            onClick={() => handleOpenMarketplace(name, accounts)}
                                                            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-brand-400 hover:shadow-sm transition-all rounded-xl group"
                                                            title={name}
                                                        >
                                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center p-0.5 shrink-0">
                                                                {getMarketplaceLogo(name) ? (
                                                                    <img
                                                                        src={getMarketplaceLogo(name)}
                                                                        alt={name}
                                                                        className="w-full h-full object-contain"
                                                                    />
                                                                ) : (
                                                                    <Building className="w-4 h-4 text-slate-400" />
                                                                )}
                                                            </div>
                                                            <span className="text-xs font-semibold text-slate-700 truncate max-w-[6rem]">
                                                                {name}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full shrink-0">
                                                                {accounts.length}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Business & GST Details (Admin only) ── */}
                                        {profileData?.role === 'Admin' && gstData !== null && (
                                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                                {/* Card header */}
                                                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                                                    <div className="flex items-center gap-2">
                                                        <FileText size={16} className="text-brand-600" />
                                                        <span className="text-sm font-bold text-slate-700">Business & GST Details</span>
                                                        <span className="text-xs text-slate-400 font-normal">— for GST invoices</span>
                                                    </div>
                                                    {!gstEditMode && (
                                                        <button
                                                            onClick={() => setGstEditMode(true)}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-lg border border-brand-200 transition-colors"
                                                        >
                                                            <Edit size={12} />
                                                            {gstData?.gstin ? 'Edit' : 'Add Details'}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Read-only view */}
                                                {!gstEditMode && (
                                                    <div className="p-4">
                                                        {gstData?.gstin ? (
                                                            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                                                {[
                                                                    ['Business Name', gstData.businessName],
                                                                    ['GSTIN', gstData.gstin],
                                                                    ['PAN', gstData.pan],
                                                                    ['State', gstData.state ? `${gstData.state} (${gstData.stateCode})` : '—'],
                                                                    ['Phone', gstData.phone],
                                                                    ['Address', gstData.address],
                                                                ].map(([label, val]) => (
                                                                    <div key={label}>
                                                                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
                                                                        <p className="font-medium text-slate-700 break-words">{val || <span className="text-slate-300 italic text-xs">Not provided</span>}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-3 py-2 text-slate-400">
                                                                <FileText size={20} className="text-slate-300" />
                                                                <div>
                                                                    <p className="text-sm font-medium text-slate-500">No GST details added yet</p>
                                                                    <p className="text-xs text-slate-400">Add your GSTIN to generate proper tax invoices for every purchase.</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Edit form */}
                                                {gstEditMode && (
                                                    <form onSubmit={handleSaveGst} className="p-4 space-y-4">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">GSTIN</label>
                                                                <div className="flex gap-2">
                                                                    <input
                                                                        type="text"
                                                                        value={gstForm.gstin}
                                                                        onChange={e => handleGstinChange(e.target.value)}
                                                                        placeholder="e.g. 24AARFH4419D1ZH"
                                                                        maxLength={15}
                                                                        className={`flex-1 px-3 py-2 font-mono text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 ${gstinError ? 'border-red-300' : 'border-slate-200'}`}
                                                                    />
                                                                    <GstAutoFill
                                                                        gstin={gstForm.gstin}
                                                                        onGstFetched={handleProfileGstFetched}
                                                                        disabled={!gstForm.gstin || gstForm.gstin.length < 15}
                                                                        buttonClassName="p-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                                                                    />
                                                                </div>
                                                                {gstinError
                                                                    ? <p className="text-red-500 text-xs mt-1">{gstinError}</p>
                                                                    : gstForm.gstin.length === 15 && !gstinError
                                                                        ? <p className="text-emerald-600 text-xs mt-1">✓ State & PAN auto-filled</p>
                                                                        : <p className="text-slate-400 text-xs mt-1">State & PAN will auto-fill when GSTIN is entered</p>
                                                                }
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Business Name</label>
                                                                <input
                                                                    type="text"
                                                                    value={gstForm.businessName}
                                                                    onChange={e => setGstForm(f => ({ ...f, businessName: e.target.value }))}
                                                                    placeholder="e.g. Hmsquare Solutions LLP"
                                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">PAN <span className="normal-case font-normal text-slate-400">(auto from GSTIN)</span></label>
                                                                <input
                                                                    type="text"
                                                                    value={gstForm.pan}
                                                                    onChange={e => setGstForm(f => ({ ...f, pan: e.target.value.toUpperCase() }))}
                                                                    placeholder="e.g. AARFH4419D"
                                                                    maxLength={10}
                                                                    className="w-full px-3 py-2 font-mono text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">State <span className="normal-case font-normal text-slate-400">(auto from GSTIN)</span></label>
                                                                <input
                                                                    type="text"
                                                                    value={gstForm.state}
                                                                    onChange={e => setGstForm(f => ({ ...f, state: e.target.value }))}
                                                                    placeholder="e.g. Gujarat"
                                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Phone</label>
                                                                <input
                                                                    type="tel"
                                                                    value={gstForm.phone}
                                                                    onChange={e => setGstForm(f => ({ ...f, phone: e.target.value }))}
                                                                    placeholder="e.g. 9913315809"
                                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
                                                                />
                                                            </div>
                                                            <div className="md:col-span-2">
                                                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Address</label>
                                                                <textarea
                                                                    value={gstForm.address}
                                                                    onChange={e => setGstForm(f => ({ ...f, address: e.target.value }))}
                                                                    placeholder="Full billing address as it should appear on invoices"
                                                                    rows={2}
                                                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-3 pt-2 border-t border-slate-100">
                                                            <button
                                                                type="submit"
                                                                disabled={savingGst || !!gstinError}
                                                                className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 disabled:opacity-50 transition-colors"
                                                            >
                                                                <Save size={14} />
                                                                {savingGst ? 'Saving…' : 'Save GST Details'}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => { setGstEditMode(false); setGstinError(''); setGstForm({ businessName: gstData?.businessName || '', gstin: gstData?.gstin || '', pan: gstData?.pan || '', address: gstData?.address || '', state: gstData?.state || '', stateCode: gstData?.stateCode || '', phone: gstData?.phone || '' }); }}
                                                                className="flex items-center gap-2 px-5 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors"
                                                            >
                                                                <X size={14} />
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </form>
                                                )}
                                            </div>
                                        )}

                                        {/* Account Status */}
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                                                Tenant Status
                                            </label>
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${profileData.tenantId.isApproved
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}>
                                                <CheckCircle size={14} />
                                                {profileData.tenantId.isApproved ? 'Approved' : 'Pending Approval'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Marketplace Accounts Popup */}
                            {selectedMarketplace && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setSelectedMarketplace(null)}>
                                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center p-1.5 border border-slate-100">
                                                    {getMarketplaceLogo(selectedMarketplace.name) ? (
                                                        <img src={getMarketplaceLogo(selectedMarketplace.name)} alt={selectedMarketplace.name} className="w-full h-full object-contain" />
                                                    ) : (
                                                        <Building className="w-5 h-5 text-slate-400" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-slate-800">{selectedMarketplace.name}</h3>
                                                    <p className="text-xs text-slate-500">{selectedMarketplace.accounts.length} account{selectedMarketplace.accounts.length > 1 ? 's' : ''}</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setSelectedMarketplace(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                                                <X size={18} className="text-slate-400" />
                                            </button>
                                        </div>
                                        <div className="px-6 py-4 space-y-2 max-h-60 overflow-y-auto">
                                            {selectedMarketplace.accounts.map((acc, idx) => (
                                                <div key={idx} className="px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                                                            <CheckCircle size={14} className="text-emerald-600" />
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-700">{acc.accountName || acc.name || 'Account'}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1 ml-9">
                                                        {acc.email || (acc.signInType === 'phone' ? acc.phone : 'OAuth API')}
                                                    </p>
                                                    {acc.analysisStartDate && (
                                                        <p className="text-[11px] text-brand-600 font-medium mt-0.5 ml-9">
                                                            Analysis Start Date: {new Date(acc.analysisStartDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'credits' && !['SuperAdmin', 'SBM', 'RM'].includes(profileData?.role) && (contextUser?.permissions?.creditUsage ?? true) && (
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                    <div className="flex justify-end mb-5">
                                        <ViewToggle
                                            view={creditsViewMode}
                                            onViewChange={setCreditsViewMode}
                                            gridLabel="Reconciliation Month"
                                            listLabel="Billing Month"
                                        />
                                    </div>
                                    <CreditsTab tenantId={profileData?.tenantId?._id} viewMode={creditsViewMode} />
                                </div>
                            )}

                            {activeTab === 'system-settings' && profileData?.role === 'SuperAdmin' && (
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                    {settingsLoading ? (
                                        <div className="flex flex-col items-center justify-center min-h-[200px]">
                                            <Loader2 className="animate-spin text-brand-600 mb-4" size={32} />
                                            <p className="text-sm text-slate-500">Loading system settings...</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-5">
                                            <div className="flex items-start gap-2.5">
                                                <div className="p-2 bg-brand-50 rounded-lg text-brand-600 border border-brand-100">
                                                    <Settings size={15} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800 text-sm">Sequence Settings</h3>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        Configure the next auto-assigned IDs for tenants and invoices.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                                        Next auto-assigned tenant ID
                                                    </label>
                                                    <div className="flex items-center gap-1.5 font-mono bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm w-fit">
                                                        <Hash size={13} className="text-[#1a2c5e]/50 shrink-0" />
                                                        <span className="text-base font-bold text-[#1a2c5e] tracking-wide">{systemSettings.nextTenantId}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-1.5">
                                                        The next approved tenant will receive this ID. Read-only.
                                                    </p>
                                                </div>

                                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                                                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                        Next invoice number
                                                    </label>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-1.5 font-mono bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 shadow-sm">
                                                            <FileText size={14} className="text-[#1a2c5e]/40 shrink-0" />
                                                            <span className="text-sm text-slate-400 select-none">{nextInvoiceNumber ? nextInvoiceNumber.replace(/\/(\d+)$/, '/') : '—'}</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={invoiceSeqDraft}
                                                                onChange={e => setInvoiceSeqDraft(e.target.value)}
                                                                onKeyDown={e => { if (e.key === 'Enter') handleSaveInvoiceSequence(); }}
                                                                className="w-20 px-1.5 py-0.5 text-sm font-bold text-[#1a2c5e] bg-white border border-[#1a2c5e]/20 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a2c5e]/20 focus:border-[#1a2c5e]/40 transition-all text-center"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={handleSaveInvoiceSequence}
                                                            disabled={savingSeq}
                                                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#1a2c5e] text-white text-xs font-semibold rounded-lg hover:bg-[#0f1a3d] active:scale-95 transition-all disabled:opacity-60 shadow-sm"
                                                        >
                                                            <Save size={13} />
                                                            {savingSeq ? 'Saving...' : 'Set'}
                                                        </button>
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 mt-2">
                                                        Sets the sequence for the next manually created invoice. The prefix and financial year are fixed.
                                                    </p>
                                                </div>
                                            </div>

                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Password Change Modal */}
                        {isPasswordModalOpen && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                                    {/* Modal Header */}
                                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                                <Lock className="text-amber-600" size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-slate-800">Change Password</h3>
                                                <p className="text-xs text-slate-500">Update your account password</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={closePasswordModal}
                                            className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-200 rounded-lg"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {/* Modal Body */}
                                    <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                                        {/* Current Password */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Current Password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showCurrentPassword ? 'text' : 'password'}
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all pr-10"
                                                    placeholder="Enter current password"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* New Password */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                New Password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showNewPassword ? 'text' : 'password'}
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all pr-10"
                                                    placeholder="Enter new password"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                            {newPassword && (
                                                <div className="mt-2">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs text-slate-500">Password Strength:</span>
                                                        <span className={`text-xs font-medium ${passwordStrength <= 25 ? 'text-red-600' :
                                                            passwordStrength <= 50 ? 'text-orange-600' :
                                                                passwordStrength <= 75 ? 'text-yellow-600' :
                                                                    'text-green-600'
                                                            }`}>
                                                            {getPasswordStrengthText()}
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${getPasswordStrengthColor()} transition-all duration-300`}
                                                            style={{ width: `${passwordStrength}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Confirm Password */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Confirm New Password
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type={showConfirmPassword ? 'text' : 'password'}
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all pr-10"
                                                    placeholder="Confirm new password"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                >
                                                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                            {confirmPassword && newPassword && (
                                                <p className={`text-xs mt-1 ${confirmPassword === newPassword ? 'text-green-600' : 'text-red-600'
                                                    }`}>
                                                    {confirmPassword === newPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                                                </p>
                                            )}
                                        </div>

                                        {/* Password Requirements */}
                                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                            <p className="text-xs font-medium text-slate-700 mb-2">Password must contain:</p>
                                            <ul className="text-xs text-slate-500 space-y-1">
                                                <li className="flex items-center gap-1.5">
                                                    <span className={newPassword.length >= 8 ? 'text-green-600' : 'text-slate-400'}>
                                                        {newPassword.length >= 8 ? '✓' : '○'}
                                                    </span>
                                                    At least 8 characters
                                                </li>
                                                <li className="flex items-center gap-1.5">
                                                    <span className={/[A-Z]/.test(newPassword) ? 'text-green-600' : 'text-slate-400'}>
                                                        {/[A-Z]/.test(newPassword) ? '✓' : '○'}
                                                    </span>
                                                    One uppercase letter
                                                </li>
                                                <li className="flex items-center gap-1.5">
                                                    <span className={/[a-z]/.test(newPassword) ? 'text-green-600' : 'text-slate-400'}>
                                                        {/[a-z]/.test(newPassword) ? '✓' : '○'}
                                                    </span>
                                                    One lowercase letter
                                                </li>
                                                <li className="flex items-center gap-1.5">
                                                    <span className={/\d/.test(newPassword) ? 'text-green-600' : 'text-slate-400'}>
                                                        {/\d/.test(newPassword) ? '✓' : '○'}
                                                    </span>
                                                    One number
                                                </li>
                                            </ul>
                                        </div>

                                        {/* Modal Actions */}
                                        <div className="pt-2 flex gap-3">
                                            <button
                                                type="button"
                                                onClick={closePasswordModal}
                                                className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                                                className="flex-1 py-2.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-500/20"
                                            >
                                                {changingPassword ? 'Updating...' : 'Update Password'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {/* Logout Confirmation Modal */}
                        {isLogoutModalOpen && (
                            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 animate-in fade-in zoom-in duration-200">
                                    {/* Modal Header */}
                                    <div className="flex items-center justify-between p-6 border-b border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                                <LogOut className="text-amber-600" size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-slate-800">Sign Out</h3>
                                                <p className="text-xs text-slate-500">Confirm your action</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={cancelLogout}
                                            className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-200 rounded-lg"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {/* Modal Body */}
                                    <div className="p-6 space-y-4">
                                        <p className="text-slate-600 text-sm">
                                            Are you sure you want to sign out? You'll need to log in again to access your account.
                                        </p>

                                        {/* Don't Ask Again Checkbox */}
                                        <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                            <input
                                                type="checkbox"
                                                id="dontAskAgain"
                                                checked={dontAskAgain}
                                                onChange={(e) => setDontAskAgain(e.target.checked)}
                                                className="mt-0.5 w-4 h-4 text-brand-600 border-slate-300 rounded focus:ring-2 focus:ring-brand-500/20 cursor-pointer"
                                            />
                                            <label htmlFor="dontAskAgain" className="text-sm text-slate-600 cursor-pointer select-none">
                                                Don't ask me again
                                                <span className="block text-xs text-slate-500 mt-0.5">
                                                    You can re-enable this in settings
                                                </span>
                                            </label>
                                        </div>

                                        {/* Modal Actions */}
                                        <div className="pt-2 flex gap-3">
                                            <button
                                                type="button"
                                                onClick={cancelLogout}
                                                className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={confirmLogout}
                                                className="flex-1 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
                                            >
                                                Yes, Sign Out
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </DashboardLayout>
    );
};

export default ProfileSettings;

