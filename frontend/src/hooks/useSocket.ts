import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Shared socket instance to avoid multiple connections across hooks
let socketInstance: Socket | null = null;

const getSocket = () => {
    if (!socketInstance) {
        // Use the current origin or VITE_API_URL
        const url = import.meta.env.VITE_API_URL || window.location.origin;
        socketInstance = io(url, {
            path: '/socket.io',
            transports: ['websocket'], // Forza websocket per evitare problemi di handshake con Cloudflare
            autoConnect: true,
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

    useEffect(() => {
        if (!userId) return;

        const registerUser = () => {
            socket.emit('user_online', userId);
        };

        const handleOnlineList = (users: (string | number)[]) => {
            setOnlineUsers(new Set(users.map(String)));
        };

        if (socket.connected) {
            registerUser();
        }

        socket.on('connect', registerUser);
        socket.on('online_users_list', handleOnlineList);

        return () => {
            socket.off('connect', registerUser);
            socket.off('online_users_list', handleOnlineList);
        };
    }, [userId, socket]);

    return { socket, onlineUsers };
};
