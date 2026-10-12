import React, { useState, useEffect } from 'react';
import api from '../api';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import { UserPlus, Trash2, Copy, Check, Search, User as UserIcon, CheckCircle, Shield, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { TOUR } from '../tour/targets';
import TourLauncher from '../tour/TourLauncher';
import { USER_MANAGEMENT_TOUR } from '../tour/steps';

const PERMISSION_GROUPS = [
    {
        label: 'Dashboard Tabs',
        keys: [
            { key: 'actionRequired', label: 'Action Required', desc: 'Access Action Required tab on dashboard', color: 'rose' },
            { key: 'orderAnalysis', label: 'Calculations Analysis', desc: 'Access Calculations Analysis tab on dashboard', color: 'brand' },
            { key: 'paymentAnalysis', label: 'Payments Analysis', desc: 'Access Payments Analysis tab on dashboard', color: 'emerald' },
            { key: 'adsAnalysis', label: 'Ads Analysis', desc: 'Access Ads Analysis tab on dashboard', color: 'blue' },
            { key: 'returnsAnalysis', label: 'Returns Analysis', desc: 'Access Returns Analysis tab on dashboard', color: 'amber' },
        ],
    },
    {
        label: 'Data Access',
        keys: [
            { key: 'uploadNew', label: 'Upload New', desc: 'Create and submit new file uploads', color: 'cyan' },
            { key: 'uploadHistory', label: 'Upload History', desc: 'View past upload history', color: 'teal' },
            { key: 'downloads', label: 'Downloads', desc: 'Access download reports section', color: 'orange' },
            { key: 'scanReturns', label: 'Scan Returns', desc: 'Access scan returns page', color: 'pink' },
        ],
    },
    {
        label: 'Settings',
        keys: [
            { key: 'marketplace', label: 'Marketplace', desc: 'Access marketplace account settings', color: 'slate' },
            { key: 'billing', label: 'Billing', desc: 'Access subscription and billing page', color: 'indigo' },
            { key: 'support', label: 'Support', desc: 'Access support portal', color: 'violet' },
            { key: 'creditUsage', label: 'Credit & Usage', desc: 'Access credit and usage tab on profile page', color: 'purple' },
            { key: 'speedAi', label: 'Speedy AI', desc: 'Access the Speedy AI assistant', color: 'sky' },
        ],
    },
];

const COLOR_MAP = {
    rose: { border: 'border-rose-300', bg: 'bg-rose-50/50', ring: 'ring-rose-200/50', text: 'text-rose-600', focus: 'focus:ring-rose-500' },
    brand: { border: 'border-brand-300', bg: 'bg-brand-50/50', ring: 'ring-brand-200/50', text: 'text-brand-600', focus: 'focus:ring-brand-500' },
    emerald: { border: 'border-emerald-300', bg: 'bg-emerald-50/50', ring: 'ring-emerald-200/50', text: 'text-emerald-600', focus: 'focus:ring-emerald-500' },
    blue: { border: 'border-blue-300', bg: 'bg-blue-50/50', ring: 'ring-blue-200/50', text: 'text-blue-600', focus: 'focus:ring-blue-500' },
    amber: { border: 'border-amber-300', bg: 'bg-amber-50/50', ring: 'ring-amber-200/50', text: 'text-amber-600', focus: 'focus:ring-amber-500' },
    cyan: { border: 'border-cyan-300', bg: 'bg-cyan-50/50', ring: 'ring-cyan-200/50', text: 'text-cyan-600', focus: 'focus:ring-cyan-500' },
    teal: { border: 'border-teal-300', bg: 'bg-teal-50/50', ring: 'ring-teal-200/50', text: 'text-teal-600', focus: 'focus:ring-teal-500' },
    orange: { border: 'border-orange-300', bg: 'bg-orange-50/50', ring: 'ring-orange-200/50', text: 'text-orange-600', focus: 'focus:ring-orange-500' },
    pink: { border: 'border-pink-300', bg: 'bg-pink-50/50', ring: 'ring-pink-200/50', text: 'text-pink-600', focus: 'focus:ring-pink-500' },
    slate: { border: 'border-slate-300', bg: 'bg-slate-50/50', ring: 'ring-slate-200/50', text: 'text-slate-600', focus: 'focus:ring-slate-500' },
    indigo: { border: 'border-indigo-300', bg: 'bg-indigo-50/50', ring: 'ring-indigo-200/50', text: 'text-indigo-600', focus: 'focus:ring-indigo-500' },
    violet: { border: 'border-violet-300', bg: 'bg-violet-50/50', ring: 'ring-violet-200/50', text: 'text-violet-600', focus: 'focus:ring-violet-500' },
    purple: { border: 'border-purple-300', bg: 'bg-purple-50/50', ring: 'ring-purple-200/50', text: 'text-purple-600', focus: 'focus:ring-purple-500' },
    sky: { border: 'border-sky-300', bg: 'bg-sky-50/50', ring: 'ring-sky-200/50', text: 'text-sky-600', focus: 'focus:ring-sky-500' },
};

const UserManagement = () => {
    const { isImpersonating } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const initialFormState = {
        fullName: '',
        email: '',
        mobileNumber: '',
        password: '',
        actionRequired: true,
        orderAnalysis: true,
        paymentAnalysis: true,
        adsAnalysis: true,
        returnsAnalysis: true,
        uploadNew: true,
        uploadHistory: true,
        downloads: true,
        scanReturns: true,
        marketplace: true,
        billing: true,
        support: true,
        creditUsage: true,
        speedAi: true,
    };

    const [formData, setFormData] = useState(initialFormState);
    const [createdUserCreds, setCreatedUserCreds] = useState(null);
    const [copied, setCopied] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    const validatePassword = (password) => {
        if (!password) return '';
        if (password.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
        if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter';
        if (!/\d/.test(password)) return 'Password must contain at least one number';
        return '';
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/auth/users');
            setUsers(res.data);
        } catch (error) {
            console.error('Error fetching users', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
        if (name === 'password') setPasswordError('');
    };

    const allPermissionsSelected = PERMISSION_GROUPS.flatMap(g => g.keys).every(p => formData[p.key]);

    const toggleAllPermissions = () => {
        const newState = !allPermissionsSelected;
        const updated = { ...formData };
        PERMISSION_GROUPS.flatMap(g => g.keys).forEach(p => { updated[p.key] = newState; });
        setFormData(updated);
    };

    const handleEditUser = (user) => {
        const perms = user.permissions || {};
        setFormData({
            fullName: user.fullName || '',
            mobileNumber: user.mobileNumber || '',
            password: '',
            actionRequired: perms.actionRequired ?? true,
            orderAnalysis: perms.orderAnalysis ?? true,
            paymentAnalysis: perms.paymentAnalysis ?? true,
            adsAnalysis: perms.adsAnalysis ?? true,
            returnsAnalysis: perms.returnsAnalysis ?? true,
            uploadNew: perms.uploadNew ?? true,
            uploadHistory: perms.uploadHistory ?? true,
            downloads: perms.downloads ?? true,
            scanReturns: perms.scanReturns ?? true,
            marketplace: perms.marketplace ?? true,
            billing: perms.billing ?? true,
            support: perms.support ?? true,
            creditUsage: perms.creditUsage ?? true,
            speedAi: perms.speedAi ?? true,
        });
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (formData.password) {
            const err = validatePassword(formData.password);
            if (err) {
                setPasswordError(err);
                return;
            }
        }
        try {
            const payload = {
                fullName: formData.fullName,
                email: formData.email,
                mobileNumber: formData.mobileNumber,
            };

            if (formData.password) {
                payload.password = formData.password;
            }

            payload.permissions = {};
            PERMISSION_GROUPS.flatMap(g => g.keys).forEach(p => {
                payload.permissions[p.key] = formData[p.key];
            });

            const res = await api.post('/auth/create-user', payload);
            setCreatedUserCreds({
                email: formData.email,
                password: formData.password ? null : res.data.password,
                userSetPassword: !!formData.password,
            });
            setUsers([...users, res.data]);
            setIsModalOpen(false);
            setEditingUser(null);
            setFormData(initialFormState);
        } catch (error) {
            console.error('Error creating user', error);
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            const payload = {};
            if (formData.fullName !== editingUser.fullName) payload.fullName = formData.fullName;
            if (formData.mobileNumber !== (editingUser.mobileNumber || '')) payload.mobileNumber = formData.mobileNumber;

            payload.permissions = {};
            PERMISSION_GROUPS.flatMap(g => g.keys).forEach(p => {
                payload.permissions[p.key] = formData[p.key];
            });

            await api.put(`/auth/users/${editingUser._id}`, payload);
            setUsers(users.map(u => u._id === editingUser._id ? { ...u, ...payload } : u));
            setIsModalOpen(false);
            setEditingUser(null);
            setFormData(initialFormState);
            toast.success('User updated successfully');
        } catch (error) {
            console.error('Error updating user', error);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.delete(`/auth/users/${userId}`);
            setUsers(users.filter(u => u._id !== userId));
        } catch (error) {
            console.error('Error deleting user', error);
            // alert('Failed to delete user');
            // Global handler catches this now
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(`Email: ${createdUserCreds.email}\nPassword: ${createdUserCreds.password}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const filteredUsers = users.filter(user =>
        user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout>
            <div className="w-full flex flex-col h-full overflow-hidden bg-slate-50">
                <header data-tour={TOUR.users.header} className="bg-slate-50 backdrop-blur-md sticky top-0 z-10 px-8 py-3 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-heading font-bold text-slate-800">
                            User Management
                        </h2>
                    </div>
                    <div className="flex items-center gap-5">
                        <TourLauncher tourKey={USER_MANAGEMENT_TOUR} />
                        {!isImpersonating && (
                            <button
                                data-tour={TOUR.users.addUserBtn}
                                onClick={() => { setEditingUser(null); setIsModalOpen(true); setCreatedUserCreds(null); setFormData(initialFormState); }}
                                className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/20"
                            >
                                <UserPlus size={16} />
                                Add New User
                            </button>
                        )}
                    </div>
                </header>

                <main className="flex-1 p-8 w-full overflow-y-auto custom-scrollbar">

                    {createdUserCreds && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-8 animate-in fade-in slide-in-from-top-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-emerald-800 font-bold text-lg mb-2 flex items-center gap-2">
                                        <CheckCircle size={20} />
                                        User Created Successfully!
                                    </h3>
                                    {createdUserCreds.userSetPassword ? (
                                        <p className="text-emerald-600 text-sm mb-4">
                                            User has been created with the password you provided.
                                        </p>
                                    ) : (
                                        <>
                                            <p className="text-emerald-600 text-sm mb-4">
                                                Please copy these credentials now. The password will <strong>not</strong> be visible again.
                                            </p>
                                            <div className="bg-white p-4 rounded-lg border border-emerald-100 font-mono text-sm text-slate-600 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-400 w-20">Email:</span>
                                                    <span>{createdUserCreds.email}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-400 w-20">Password:</span>
                                                    <span className="bg-slate-100 px-2 rounded text-slate-800">{createdUserCreds.password}</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                {!createdUserCreds.userSetPassword && (
                                    <button
                                        onClick={copyToClipboard}
                                        className="flex items-center gap-2 text-emerald-700 hover:text-emerald-800 font-medium bg-emerald-100 hover:bg-emerald-200 px-4 py-2 rounded-lg transition-colors"
                                    >
                                        {copied ? <Check size={18} /> : <Copy size={18} />}
                                        {copied ? 'Copied' : 'Copy Details'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div data-tour={TOUR.users.table} className="bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden mb-12">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div data-tour={TOUR.users.search} className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                                        <th data-tour={TOUR.users.permissionsColumn} className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Permissions</th>
                                        <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-8 text-center text-slate-400 text-sm">
                                                No users found.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <tr key={user._id} className="hover:bg-slate-50/50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                            <UserIcon size={16} />
                                                        </div>
                                                        <div className="text-sm font-semibold text-slate-700">{user.fullName}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{user.email}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-1 rounded-md border border-blue-100">
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-wrap gap-1">
                                                        {PERMISSION_GROUPS.flatMap(g => g.keys).map((perm) => {
                                                            const colors = COLOR_MAP[perm.color];
                                                            const enabled = user.permissions?.[perm.key];
                                                            return enabled ? (
                                                                <span key={perm.key} className={`inline-flex items-center px-2 py-0.5 ${colors.bg} ${colors.text} border ${colors.border} rounded-md text-[11px] font-medium`}>
                                                                    {perm.label}
                                                                </span>
                                                            ) : null;
                                                        })}
                                                        {!PERMISSION_GROUPS.flatMap(g => g.keys).some(p => user.permissions?.[p.key]) && (
                                                            <span className="text-[11px] text-slate-400">No permissions</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    {!isImpersonating && (
                                                        <>
                                                            <button
                                                                onClick={() => handleEditUser(user)}
                                                                className="text-slate-400 hover:text-brand-600 transition-colors p-2 hover:bg-brand-50 rounded-lg"
                                                                title="Edit User"
                                                            >
                                                                <Pencil size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteUser(user._id)}
                                                                className="text-slate-400 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
                                                                title="Delete User"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </main>
            </div>

            {isModalOpen && !isImpersonating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <h3 className="font-bold text-lg text-slate-800">{editingUser ? 'Edit User' : 'Add New User'}</h3>
                            <button onClick={() => { setIsModalOpen(false); setEditingUser(null); }} className="text-slate-400 hover:text-slate-600">
                                &#10005;
                            </button>
                        </div>
                        <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    name="fullName"
                                    required
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    value={formData.fullName}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number (Optional)</label>
                                <input
                                    type="tel"
                                    name="mobileNumber"
                                    placeholder="+91XXXXXXXXXX or 10 digits"
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    value={formData.mobileNumber}
                                    onChange={handleInputChange}
                                    pattern="(\+91)?[6-9]\d{9}"
                                />
                                <p className="text-xs text-slate-400 mt-1">Used for account verification</p>
                            </div>
                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            )}
                            {!editingUser && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Password (Optional)</label>
                                    <input
                                        type="text"
                                        name="password"
                                        placeholder="Leave blank to auto-generate"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                    />
                                    <p className="text-xs text-slate-400 mt-1">If left blank, a secure password will be generated automatically.</p>
                                    {passwordError && (
                                        <p className="text-xs text-red-500 mt-1">{passwordError}</p>
                                    )}
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-brand-500" />
                                        Permissions
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={toggleAllPermissions}
                                        className="text-xs font-medium text-brand-600 hover:text-brand-700 px-3 py-1 rounded-lg border border-brand-200 hover:bg-brand-50 transition-colors"
                                    >
                                        {allPermissionsSelected ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                {PERMISSION_GROUPS.map((group) => (
                                    <div key={group.label} className="mb-4">
                                        <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{group.label}</h5>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {group.keys.map((perm) => {
                                                const colors = COLOR_MAP[perm.color];
                                                const isChecked = formData[perm.key];
                                                return (
                                                    <label
                                                        key={perm.key}
                                                        className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-all duration-200 ${
                                                            isChecked
                                                                ? `${colors.border} ${colors.bg} ${colors.ring} ring-1 shadow-sm`
                                                                : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            name={perm.key}
                                                            checked={isChecked}
                                                            onChange={handleInputChange}
                                                            className={`w-4 h-4 ${colors.text} rounded border-slate-300 ${colors.focus} cursor-pointer`}
                                                        />
                                                        <div>
                                                            <div className="text-sm font-semibold text-slate-700">{perm.label}</div>
                                                            <div className="text-xs text-slate-500 mt-0.5">{perm.desc}</div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 flex gap-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => { setIsModalOpen(false); setEditingUser(null); }}
                                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-700 shadow-lg shadow-brand-500/20"
                                >
                                    {editingUser ? 'Save Changes' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default UserManagement;