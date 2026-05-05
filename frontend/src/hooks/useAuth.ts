import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import type { DecodedAuthToken } from '../types/auth';

export const useAuth = () => {
    const [user, setUser] = useState<DecodedAuthToken | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('jwt_token');
        if (token) {
            try {
                const decoded = jwtDecode<DecodedAuthToken>(token);
                setUser(decoded);
            } catch (error) {
                console.error("Failed to decode JWT:", error);
                setUser(null);
            }
        }
    }, []);

    return { user };
};
