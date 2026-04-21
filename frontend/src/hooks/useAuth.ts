import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
    id: number;
    employee_id: number;
    role: string;
    iat: number;
    exp: number;
}

export const useAuth = () => {
    const [user, setUser] = useState<DecodedToken | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('jwt_token');
        if (token) {
            try {
                const decoded = jwtDecode<DecodedToken>(token);
                setUser(decoded);
            } catch (error) {
                console.error("Failed to decode JWT:", error);
                setUser(null);
            }
        }
    }, []);

    return { user };
};