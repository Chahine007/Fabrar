import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import logger from "../logger.js";
import { getDb } from "../db/index.js";
import { getJwtVerifyOptions } from "../constants.js";
import { normalizeUserPayload } from "../middleware/auth.js";

const userSockets = new Map(); // employee_id -> Set<socket_id>

export function employeeRoom(employeeId) {
    return `employee:${Number(employeeId)}`;
}

function getOrCreateSocketSet(employeeId) {
    const normalizedEmployeeId = Number(employeeId);
    if (!userSockets.has(normalizedEmployeeId)) {
        userSockets.set(normalizedEmployeeId, new Set());
    }
    return userSockets.get(normalizedEmployeeId);
}

function removeSocketFromUser(employeeId, socketId) {
    const normalizedEmployeeId = Number(employeeId);
    const sockets = userSockets.get(normalizedEmployeeId);
    if (!sockets) return false;

    sockets.delete(socketId);
    if (sockets.size === 0) {
        userSockets.delete(normalizedEmployeeId);
    }

    return true;
}

export function getActiveSockets(employeeId) {
    const sockets = userSockets.get(Number(employeeId));
    return sockets ? Array.from(sockets) : [];
}

function getSocketToken(socket) {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.trim()) return authToken.trim();

    const authHeader = socket.handshake.headers?.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        return authHeader.slice("Bearer ".length).trim();
    }

    return null;
}

function getAllowedSocketOrigins() {
    const configuredOrigins = [
        process.env.SOCKET_CORS_ORIGINS,
        process.env.CORS_ORIGIN,
        process.env.FRONTEND_URL,
        process.env.CLIENT_URL,
        process.env.BASE_URL,
    ]
        .filter(Boolean)
        .flatMap((value) => String(value).split(","))
        .map((value) => value.trim())
        .filter(Boolean);

    if (process.env.NODE_ENV !== "production") {
        configuredOrigins.push(
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000"
        );
    }

    return new Set(configuredOrigins);
}

function registerAuthenticatedSocket(io, socket) {
    const employeeId = Number(socket.data.employeeId);
    if (!Number.isInteger(employeeId) || employeeId <= 0) return;

    const sockets = getOrCreateSocketSet(employeeId);
    sockets.add(socket.id);
    socket.join(employeeRoom(employeeId));

    logger.info(
        {
            employeeId,
            socketId: socket.id,
            activeSocketCount: sockets.size,
            event: "socket_authenticated"
        },
        "socket_authenticated"
    );

    io.emit("online_users_list", Array.from(userSockets.keys()));
}

async function emitTypingToConversation(io, socket, eventName, data) {
    const employeeId = Number(socket.data.employeeId);
    const conversationId = String(data?.conversationId ?? "").trim();
    if (!conversationId || !Number.isInteger(employeeId) || employeeId <= 0) return;

    const participants = await getDb().conversationParticipant.findMany({
        where: { conversation_id: conversationId },
        select: { employee_id: true },
    });

    if (!participants.some((participant) => participant.employee_id === employeeId)) {
        return;
    }

    const payload = {
        conversationId,
        userId: employeeId,
        ...(eventName === "user_typing"
            ? { userName: String(data?.userName ?? "").trim().slice(0, 80) }
            : {}),
    };

    for (const participant of participants) {
        if (participant.employee_id === employeeId) continue;
        io.to(employeeRoom(participant.employee_id)).emit(eventName, payload);
    }
}

export function initSockets(server) {
    const allowedOrigins = getAllowedSocketOrigins();
    const io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) return callback(null, true);
                if (allowedOrigins.has(origin)) return callback(null, true);
                if (process.env.NODE_ENV !== "production" && allowedOrigins.size === 0) {
                    return callback(null, true);
                }
                return callback(new Error("Socket origin non autorizzata"), false);
            },
            methods: ["GET", "POST"],
            credentials: true
        },
        pingTimeout: 30000,
        pingInterval: 10000,
        connectTimeout: 20000,
        allowEIO3: true // Support older clients if any
    });

    io.use((socket, next) => {
        const token = getSocketToken(socket);
        if (!token) {
            return next(new Error("UNAUTHORIZED"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET, getJwtVerifyOptions());
            const user = normalizeUserPayload(decoded);
            if (!user?.employee_id || !user.role) {
                return next(new Error("UNAUTHORIZED"));
            }

            socket.data.user = user;
            socket.data.employeeId = Number(user.employee_id);
            return next();
        } catch (err) {
            return next(new Error("UNAUTHORIZED"));
        }
    });

    // Diagnostica per errori di connessione (fondamentale per debuggare Cloudflare/EOF)
    io.engine.on("connection_error", (err) => {
        logger.error({ 
            event: "socket_connection_error",
            code: err.code,
            message: err.message,
            context: err.context
        }, "socket_connection_error");
    });

    io.on("connection", (socket) => {
        logger.info({ socketId: socket.id, employeeId: socket.data.employeeId }, "Socket connected");
        registerAuthenticatedSocket(io, socket);

        socket.on("user_online", () => {
            registerAuthenticatedSocket(io, socket);
        });

        socket.on("typing_start", (data) => {
            emitTypingToConversation(io, socket, "user_typing", data).catch((err) => {
                logger.warn({ err, socketId: socket.id }, "typing_start_rejected");
            });
        });

        socket.on("typing_stop", (data) => {
            emitTypingToConversation(io, socket, "user_stopped_typing", data).catch((err) => {
                logger.warn({ err, socketId: socket.id }, "typing_stop_rejected");
            });
        });

        socket.on("disconnect", () => {
            const employeeId = Number(socket.data.employeeId);
            if (Number.isInteger(employeeId) && employeeId > 0) {
                removeSocketFromUser(employeeId, socket.id);
                logger.info(
                    {
                        employeeId,
                        socketId: socket.id,
                        remainingSocketCount: getActiveSockets(employeeId).length,
                        event: "user_offline"
                    },
                    "user_offline"
                );
            }

            io.emit("online_users_list", Array.from(userSockets.keys()));
            logger.info({ socketId: socket.id }, "Socket disconnected");
        });
    });

    return io;
}
