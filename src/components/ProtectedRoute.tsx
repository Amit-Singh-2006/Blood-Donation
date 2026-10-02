import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Role, getUser, rememberLastRole } from '../lib/session';
import { refreshSession } from '../lib/api';

interface ProtectedRouteProps {
    allowedRoles: Role[];
}

/**
 * Opens a dashboard only when this browser is signed in to that kind of
 * account. Being signed in as another kind (say, an admin opening /hospital)
 * leads to sign-in for this one, not away to the other dashboard. When the
 * page has no record of the account, a kept sign-in ("keep me signed in") is
 * checked with the server before asking the user to sign in again.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
    const role = allowedRoles[0]!;
    const signedIn = allowedRoles.some((r) => getUser(r));
    // null while asking the server; then whether a kept sign-in was found
    const [kept, setKept] = useState<boolean | null>(null);

    useEffect(() => {
        if (signedIn) {
            rememberLastRole(role);
            return;
        }
        if (kept !== null) return;
        let live = true;
        refreshSession(role).then((users) => {
            if (live) setKept(!!users?.length);
        });
        return () => { live = false; };
    }, [signedIn, kept, role]);

    if (signedIn || kept) return <Outlet />;
    if (kept === null) {
        return <div className="min-h-screen flex items-center justify-center text-sm font-bold text-slate-400">Loading…</div>;
    }
    return <Navigate to={`/login?as=${role}`} replace />;
};

export default ProtectedRoute;
