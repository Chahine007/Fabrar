import { getDb } from "../db/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Utility locale per formattare l'ora in stile "14:30"
function formatMessageTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export const listConversations = asyncHandler(async (req, res) => {
    const prisma = getDb();

    let convs = await prisma.conversation.findMany({
        include: {
            messages: {
                orderBy: { created_at: 'desc' },
                take: 1
            }
        },
        orderBy: { isPinned: 'desc' }
    });

    // Se la tabella è vuota o mancano chat di sistema, creiamole
    if (convs.length === 0) {
        await prisma.conversation.create({
            data: {
                name: 'Assistenza Tecnica',
                type: 'system',
                isPinned: true,
                messages: {
                    create: {
                        type: 'system_task',
                        content: 'Benvenuto nel sistema ERP Fabrar. Qui riceverai notifiche e assistenza.'
                    }
                }
            }
        });
        // Ripeti il query per avere i dati dopo il seed
        convs = await prisma.conversation.findMany({
            include: { messages: { orderBy: { created_at: 'desc' }, take: 1 } },
            orderBy: { isPinned: 'desc' }
        });
    }

    const mapped = convs.map(c => {
        const lastMsg = c.messages && c.messages[0];
        let timestamp = "";
        try {
            timestamp = lastMsg ? formatMessageTime(lastMsg.created_at) : "";
        } catch (e) {
            timestamp = "";
        }

        return {
            id: c.id,
            name: c.name || "Conversazione",
            preview: lastMsg ? lastMsg.content : "Nessun messaggio",
            timestamp,
            unreadCount: c.unreadCount || 0,
            type: c.type || "system",
            avatar: c.type === 'system'
                ? 'https://ui-avatars.com/api/?name=S&background=6366f1&color=fff'
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || 'U')}&background=random`,
            isPinned: !!c.isPinned,
            projectContext: c.cantiere_id ? { status: 'In Corso', team: 'Staff Progetto' } : undefined
        };
    });

    res.json(mapped);
});

export const getConversationMessages = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const prisma = getDb();
    const currentUserId = req.user?.employee_id;

    // Azzera il contatore dei messaggi non letti quando la chat viene aperta
    await prisma.conversation.update({
        where: { id: id },
        data: { unreadCount: 0 }
    });

    const messages = await prisma.message.findMany({
        where: { conversation_id: id },
        orderBy: { created_at: 'asc' },
        include: {
            sender: {
                select: {
                    nome: true,
                    cognome: true,
                }
            }
        }
    });

    const mapped = messages.map(m => {
        const senderName = m.sender ? `${m.sender.nome || ''} ${m.sender.cognome || ''}`.trim() || `Utente ${m.sender_id}` : 'Sistema';
        const senderAvatar = m.sender ? `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=random` : '';

        return {
            id: m.id,
            senderId: m.sender_id ? String(m.sender_id) : 'system',
            senderName,
            senderAvatar,
            type: m.type,
            content: m.content,
            timestamp: formatMessageTime(m.created_at),
            isMe: currentUserId && m.sender_id === currentUserId,
            status: 'read',
            metadata: null
        };
    });

    res.json(mapped);
});

export const createMessage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { content, type } = req.body;
    const currentUserId = req.user?.employee_id;

    const prisma = getDb();

    const [newMessage] = await prisma.$transaction([
        prisma.message.create({
            data: {
                conversation_id: id,
                sender_id: currentUserId,
                type,
                content,
            }
        }),
        prisma.conversation.update({ where: { id }, data: { unreadCount: { increment: 1 } } })
    ]);

    res.status(201).json(newMessage);
});