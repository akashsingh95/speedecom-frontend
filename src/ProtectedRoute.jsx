import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ allowedRoles }) => {
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Or redirect to unauthorized page
        return <div className="p-8 text-center text-red-600">You are not authorized to view this page.</div>;
    }

    return <Outlet />;
};

export default ProtectedRoute;
