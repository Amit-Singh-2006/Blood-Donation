import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Role, getUser } from '../lib/session';

interface ProtectedRouteProps {
    allowedRoles: Role[];
}

/**
 * Opens a dashboard only when this browser is signed in to that kind of
 * account. Being signed in as another kind (say, an admin opening /hospital)
 * leads to sign-in for this one, not away to the other dashboard.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
    const signedIn = allowedRoles.some((role) => getUser(role));
    if (!signedIn) {
        return <Navigate to={`/login?as=${allowedRoles[0]}`} replace />;
    }
    return <Outlet />;
};

export default ProtectedRoute;
