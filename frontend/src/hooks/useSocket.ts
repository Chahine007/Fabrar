import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { getToken } from '../lib/api';
import { accountingKeys, billingKeys, cantierKeys, dashboardKeys, hrKeys, magazzinoKeys } from './api/queryKeys';

// Shared socket instance to avoid multiple connections across hooks
let socketInstance: Socket | null = null;
let activeSocketConsumers = 0;

const getSocket = () => {
    if (!socketInstance) {
        // Use the current origin or VITE_API_URL
        const url = import.meta.env.VITE_API_URL || window.location.origin;
        socketInstance = io(url, {
            path: '/socket.io',
            transports: ['websocket'], // Forza websocket per evitare problemi di handshake con Cloudflare
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000
        });
    }
    return socketInstance;
};

export const useSocket = (userId?: number) => {
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const socket = getSocket();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!userId) return;
        const token = getToken();
        if (!token) return;

        activeSocketConsumers += 1;
        socket.auth = { token };
        if (!socket.connected) {
            socket.connect();
        }

        const registerUser = () => {
            socket.emit('user_online');
        };

        const handleOnlineList = (users: (string | number)[]) => {
            setOnlineUsers(new Set(users.map(String)));
        };

        const handleKpiRefresh = ({ cantiereId }: { cantiereId?: number | null }) => {
            queryClient.invalidateQueries({ queryKey: dashboardKeys.all() });
            queryClient.invalidateQueries({ queryKey: cantierKeys.all() });
            queryClient.invalidateQueries({ queryKey: hrKeys.all() });
            queryClient.invalidateQueries({ queryKey: magazzinoKeys.all() });
            queryClient.invalidateQueries({ queryKey: accountingKeys.all() });
            if (cantiereId) {
                queryClient.invalidateQueries({ queryKey: billingKeys.project(cantiereId) });
            } else {
                queryClient.invalidateQueries({ queryKey: billingKeys.all() });
            }
        };

        if (socket.connected) {
            registerUser();
        }

        socket.on('connect', registerUser);
        socket.on('online_users_list', handleOnlineList);
        socket.on('kpi:refresh', handleKpiRefresh);

        return () => {
            socket.off('connect', registerUser);
            socket.off('online_users_list', handleOnlineList);
            socket.off('kpi:refresh', handleKpiRefresh);
            activeSocketConsumers = Math.max(0, activeSocketConsumers - 1);
            if (activeSocketConsumers === 0) {
                socket.disconnect();
            }
        };
    }, [userId, socket, queryClient]);

    return { socket, onlineUsers };
};
