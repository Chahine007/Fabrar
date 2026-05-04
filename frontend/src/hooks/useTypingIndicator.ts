import { useEffect, useMemo, useRef, useState } from 'react';
import { useSocket } from './useSocket';

interface TypingUserEntry {
    userId: number;
    userName: string;
}

interface TypingUsersState {
    [conversationId: string]: TypingUserEntry[];
}

export const useTypingIndicator = (activeConvId: string | null, currentUser: any) => {
    const { socket } = useSocket(currentUser?.employee_id);
    const [typingUsers, setTypingUsers] = useState<TypingUsersState>({});
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!socket) return;

        const handleUserTyping = ({ conversationId, userId, userName }: { conversationId: string, userId: number, userName: string }) => {
            if (userId === currentUser?.employee_id) return; // Non mostrare me stesso

            setTypingUsers(prev => {
                const usersInConv = prev[conversationId] || [];
                if (usersInConv.some((entry) => entry.userId === userId)) {
                    return prev;
                }

                return {
                    ...prev,
                    [conversationId]: [
                        ...usersInConv,
                        {
                            userId,
                            userName: userName?.trim() || `Utente ${userId}`,
                        }
                    ]
                };
            });
        };

        const handleUserStoppedTyping = ({ conversationId, userId }: { conversationId: string, userId: number }) => {
            setTypingUsers(prev => {
                const usersInConv = (prev[conversationId] || []).filter((entry) => entry.userId !== userId);
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

    const currentUserName =
        `${currentUser?.nome || ''} ${currentUser?.cognome || ''}`.trim() ||
        currentUser?.username ||
        (currentUser?.employee_id ? `Utente ${currentUser.employee_id}` : 'Utente');

    const typingUserNames = useMemo(
        () =>
            Object.fromEntries(
                Object.entries(typingUsers).map(([conversationId, entries]) => [
                    conversationId,
                    entries.map((entry) => entry.userName),
                ])
            ) as Record<string, string[]>,
        [typingUsers]
    );

    const handleTypingStart = () => {
        if (!socket || !activeConvId) return;
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        socket.emit('typing_start', {
            conversationId: activeConvId,
            userId: currentUser?.employee_id,
            userName: currentUserName,
        });

        typingTimeoutRef.current = setTimeout(() => {
            socket.emit('typing_stop', { conversationId: activeConvId, userId: currentUser?.employee_id });
        }, 2000);
    };

    const handleTypingStop = () => {
        if (!socket || !activeConvId) return;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socket.emit('typing_stop', { conversationId: activeConvId, userId: currentUser?.employee_id });
    };

    return { typingUsers: typingUserNames, handleTypingStart, handleTypingStop };
};
