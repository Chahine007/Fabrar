import { useEffect, useState, useRef } from 'react';
import { useSocket } from './useSocket';

interface TypingUsers {
    [conversationId: string]: string[];
}

export const useTypingIndicator = (activeConvId: string | null, currentUser: any) => {
    const { socket } = useSocket(currentUser?.employee_id);
    const [typingUsers, setTypingUsers] = useState<TypingUsers>({});
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!socket) return;

        const handleUserTyping = ({ conversationId, userId, userName }: { conversationId: string, userId: number, userName: string }) => {
            if (userId === currentUser?.employee_id) return; // Non mostrare me stesso

            setTypingUsers(prev => {
                const usersInConv = prev[conversationId] || [];
                if (!usersInConv.includes(userName)) {
                    return { ...prev, [conversationId]: [...usersInConv, userName] };
                }
                return prev;
            });
        };

        const handleUserStoppedTyping = ({ conversationId, userId }: { conversationId: string, userId: number }) => {
            setTypingUsers(prev => {
                const usersInConv = (prev[conversationId] || []).filter(name => name !== `Utente ${userId}`); // Semplificato
                return { ...prev, [conversationId]: usersInConv };
            });
        };

        socket.on('user_typing', handleUserTyping);
        socket.on('user_stopped_typing', handleUserStoppedTyping);

        return () => {
            socket.off('user_typing', handleUserTyping);
            socket.off('user_stopped_typing', handleUserStoppedTyping);
        };
    }, [socket, currentUser]);

    const handleTypingStart = () => {
        if (!socket || !activeConvId) return;
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        socket.emit('typing_start', { conversationId: activeConvId, userId: currentUser?.employee_id, userName: `${currentUser?.nome || ''} ${currentUser?.cognome || ''}`.trim() });

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('typing_stop', { conversationId: activeConvId, userId: currentUser?.employee_id });
        }, 2000);
    };

    const handleTypingStop = () => {
        if (!socket || !activeConvId) return;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socket.emit('typing_stop', { conversationId: activeConvId, userId: currentUser?.employee_id });
    };

    return { typingUsers, handleTypingStart, handleTypingStop };
};