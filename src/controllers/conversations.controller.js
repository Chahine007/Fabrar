import { getDb } from "../db/index.js";
import { employeeRoom } from "../sockets/index.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parsePagination } from "../utils/pagination.js";

function formatMessageTime(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function getCurrentEmployeeId(req, res) {
    const employeeId = Number(req.user?.employee_id);
    if (!Number.isInteger(employeeId) || employeeId <= 0) {
        res.status(403).json({ error: "Accesso negato: profilo dipendente non associato." });
        return null;
    }
    return employeeId;
}

function buildEmployeeName(employee) {
    const fullName = `${employee?.nome || ""} ${employee?.cognome || ""}`.trim();
    if (fullName) return fullName;
    if (employee?.id) return `Utente ${employee.id}`;
    return "Conversazione";
}

function buildAvatar(name, type) {
    if (type === "system") {
        return "https://ui-avatars.com/api/?name=S&background=6366f1&color=fff";
    }

    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&background=random`;
}

function getMessagePreview(message) {
    const content = typeof message?.content === "string" ? message.content.trim() : "";
    return content || "Nessun messaggio";
}

function mapMessageResponse(message, currentEmployeeId) {
    const senderName = message.sender
        ? `${message.sender.nome || ""} ${message.sender.cognome || ""}`.trim() || `Utente ${message.sender_id}`
        : "Sistema";
    const senderAvatar = message.sender
        ? `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=random`
        : "";
    const content = typeof message.content === "string" ? message.content : "";

    return {
        id: message.id,
        conversation_id: message.conversation_id,
        sender_id: message.sender_id,
        sender_name: senderName,
        sender_avatar: senderAvatar,
        type: message.type,
        content,
        created_at: message.created_at,
        metadata: null,
        is_me: currentEmployeeId != null && message.sender_id === currentEmployeeId,
    };
}

function mapConversationSummary(conversation, currentEmployeeId) {
    const conversationType = String(conversation.type || "system").toLowerCase();
    const lastMessage = conversation.messages?.[0] ?? null;
    const currentParticipant = conversation.participants?.find(
        (participant) => participant.employee_id === currentEmployeeId
    ) ?? null;
    const otherParticipant = conversationType === "direct"
        ? conversation.participants?.find((participant) => participant.employee_id !== currentEmployeeId) ?? null
        : null;

    const displayName = otherParticipant?.employee
        ? buildEmployeeName(otherParticipant.employee)
        : conversation.name || "Conversazione";

    return {
        id: conversation.id,
        name: displayName,
        preview: lastMessage ? getMessagePreview(lastMessage) : "Nessun messaggio",
        timestamp: lastMessage ? formatMessageTime(lastMessage.created_at) : "",
        lastActivityAt: lastMessage?.created_at ?? conversation.created_at,
        unreadCount: currentParticipant?.unread_count || 0,
        type: conversationType,
        avatar: buildAvatar(displayName, conversationType),
        isPinned: !!conversation.isPinned,
        cantiereId: conversation.cantiere_id ?? null,
        participants: (conversation.participants || []).map((participant) => ({
            employee_id: participant.employee_id,
            unread_count: participant.unread_count,
            joined_at: participant.joined_at,
        })),
    };
}

async function ensureSystemConversationForEmployee(prisma, employeeId) {
    let assistanceConversation = await prisma.conversation.findFirst({
        where: { type: "system", name: "Assistenza Tecnica" },
        select: { id: true },
    });

    if (!assistanceConversation) {
        assistanceConversation = await prisma.conversation.create({
            data: {
                name: "Assistenza Tecnica",
                type: "system",
                isPinned: true,
                messages: {
                    create: {
                        type: "system_task",
                        content: "Benvenuto nel sistema ERP Fabrar. Qui riceverai notifiche e assistenza.",
                    },
                },
            },
            select: { id: true },
        });
    }

    await prisma.conversationParticipant.upsert({
        where: {
            conversation_id_employee_id: {
                conversation_id: assistanceConversation.id,
                employee_id: employeeId,
            },
        },
        update: {},
        create: {
            conversation_id: assistanceConversation.id,
            employee_id: employeeId,
        },
    });
}

async function loadConversationSummary(prisma, conversationId, currentEmployeeId) {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
            messages: {
                orderBy: { created_at: "desc" },
                take: 1,
            },
            participants: {
                select: {
                    employee_id: true,
                    unread_count: true,
                    joined_at: true,
                    employee: {
                        select: {
                            id: true,
                            nome: true,
                            cognome: true,
                        },
                    },
                },
            },
        },
    });

    return conversation ? mapConversationSummary(conversation, currentEmployeeId) : null;
}

export const listConversations = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const currentEmployeeId = getCurrentEmployeeId(req, res);
    if (currentEmployeeId == null) return;

    await ensureSystemConversationForEmployee(prisma, currentEmployeeId);

    const conversations = await prisma.conversation.findMany({
        where: {
            participants: {
                some: { employee_id: currentEmployeeId },
            },
        },
        include: {
            messages: {
                orderBy: { created_at: "desc" },
                take: 1,
            },
            participants: {
                select: {
                    employee_id: true,
                    unread_count: true,
                    joined_at: true,
                    employee: {
                        select: {
                            id: true,
                            nome: true,
                            cognome: true,
                        },
                    },
                },
            },
        },
        orderBy: [{ isPinned: "desc" }, { created_at: "desc" }],
    });

    res.json(conversations.map((conversation) => mapConversationSummary(conversation, currentEmployeeId)));
});

export const findOrCreateDirectConversation = asyncHandler(async (req, res) => {
    const prisma = getDb();
    const currentEmployeeId = getCurrentEmployeeId(req, res);
    if (currentEmployeeId == null) return;

    const targetEmployeeId = Number(req.body.targetEmployeeId);
    if (!Number.isInteger(targetEmployeeId) || targetEmployeeId <= 0) {
        return res.status(400).json({ error: "ID dipendente destinatario non valido." });
    }

    if (targetEmployeeId === currentEmployeeId) {
        return res.status(400).json({ error: "Non puoi creare una chat diretta con te stesso." });
    }

    const targetEmployee = await prisma.employee.findUnique({
        where: { id: targetEmployeeId },
        select: {
            id: true,
            nome: true,
            cognome: true,
            attivo: true,
        },
    });

    if (!targetEmployee || targetEmployee.attivo !== 1) {
        return res.status(404).json({ error: "Dipendente destinatario non trovato." });
    }

    const existingConversation = await prisma.conversation.findFirst({
        where: {
            AND: [
                { type: { in: ["DIRECT", "direct"] } },
                { participants: { some: { employee_id: currentEmployeeId } } },
                { participants: { some: { employee_id: targetEmployeeId } } },
                { participants: { every: { employee_id: { in: [currentEmployeeId, targetEmployeeId] } } } },
            ],
        },
        select: { id: true },
    });

    if (existingConversation) {
        const summary = await loadConversationSummary(prisma, existingConversation.id, currentEmployeeId);
        return res.json(summary);
    }

    const directConversation = await prisma.conversation.create({
        data: {
            name: buildEmployeeName(targetEmployee),
            type: "DIRECT",
            participants: {
                create: [
                    { employee_id: currentEmployeeId },
                    { employee_id: targetEmployeeId },
                ],
            },
        },
        select: { id: true },
    });

    const summary = await loadConversationSummary(prisma, directConversation.id, currentEmployeeId);
    res.status(201).json(summary);
});

export const getConversationMessages = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const prisma = getDb();
    const currentUserId = getCurrentEmployeeId(req, res);
    if (currentUserId == null) return;
    const { limit, offset } = parsePagination(req.query, { defaultLimit: 200, maxLimit: 500 });
    const cursor = typeof req.query.cursor === "string" && req.query.cursor.trim()
        ? req.query.cursor.trim()
        : null;

    const participant = await prisma.conversationParticipant.findUnique({
        where: {
            conversation_id_employee_id: {
                conversation_id: id,
                employee_id: currentUserId,
            },
        },
    });

    if (!participant) {
        return res.status(403).json({ error: "Accesso negato: non partecipi a questa conversazione." });
    }

    const messages = await prisma.$transaction(async (tx) => {
        await tx.conversationParticipant.update({
            where: {
                conversation_id_employee_id: {
                    conversation_id: id,
                    employee_id: currentUserId,
                },
            },
            data: { unread_count: 0 },
        });

        return tx.message.findMany({
            where: { conversation_id: id },
            orderBy: { created_at: "asc" },
            take: limit,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip: offset }),
            include: {
                sender: {
                    select: {
                        nome: true,
                        cognome: true,
                    },
                },
            },
        });
    });

    const mapped = messages.map((message) => {
        const response = mapMessageResponse(message, currentUserId);
        return {
            id: response.id,
            senderId: response.sender_id ? String(response.sender_id) : "system",
            senderName: response.sender_name,
            senderAvatar: response.sender_avatar,
            type: response.type,
            content: response.content,
            timestamp: formatMessageTime(response.created_at),
            isMe: !!response.is_me,
            status: "read",
            metadata: response.metadata,
        };
    });

    res.json(mapped);
});

export const createMessage = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { content, type } = req.body;
    const prisma = getDb();
    const currentUserId = getCurrentEmployeeId(req, res);
    if (currentUserId == null) return;
    const normalizedType = typeof type === "string" && type.trim() ? type.trim() : "text";
    const normalizedContent = typeof content === "string" ? content.trim() : "";

    if (normalizedType !== "text") {
        return res.status(400).json({ error: "Tipo messaggio non supportato." });
    }

    const participant = await prisma.conversationParticipant.findUnique({
        where: {
            conversation_id_employee_id: {
                conversation_id: id,
                employee_id: currentUserId,
            },
        },
    });

    if (!participant) {
        return res.status(403).json({ error: "Accesso negato: non partecipi a questa conversazione." });
    }

    if (!normalizedContent) {
        return res.status(400).json({ error: "Il contenuto del messaggio è obbligatorio." });
    }

    const { newMessage, participants } = await prisma.$transaction(async (tx) => {
        const createdMessage = await tx.message.create({
            data: {
                conversation_id: id,
                sender_id: currentUserId,
                type: "text",
                content: normalizedContent,
            },
            include: {
                sender: {
                    select: {
                        nome: true,
                        cognome: true,
                    },
                },
            },
        });

        await tx.conversationParticipant.updateMany({
            where: {
                conversation_id: id,
                employee_id: { not: currentUserId },
            },
            data: {
                unread_count: { increment: 1 },
            },
        });

        const updatedParticipants = await tx.conversationParticipant.findMany({
            where: { conversation_id: id },
            select: {
                employee_id: true,
                unread_count: true,
            },
        });

        return {
            newMessage: createdMessage,
            participants: updatedParticipants,
        };
    });
    const mappedMessage = mapMessageResponse(newMessage, currentUserId);

    const io = req.app.get("io");
    if (io) {
        for (const conversationParticipant of participants) {
            io.to(employeeRoom(conversationParticipant.employee_id)).emit("new_message", {
                conversationId: id,
                message: mappedMessage,
            });

            io.to(employeeRoom(conversationParticipant.employee_id)).emit("conversation_updated", {
                conversationId: id,
                unreadCount: conversationParticipant.unread_count,
            });
        }
    }

    res.status(201).json(mappedMessage);
});
