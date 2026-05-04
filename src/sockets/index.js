import { Server } from "socket.io";
import logger from "../logger.js";

const userSockets = new Map(); // employee_id -> Set<socket_id>

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

export function initSockets(server) {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            credentials: true
        },
        pingTimeout: 30000,
        pingInterval: 10000,
        connectTimeout: 20000,
        allowEIO3: true // Support older clients if any
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
        logger.info({ socketId: socket.id }, "Socket connected");

        socket.on("user_online", (employeeId) => {
            const normalizedEmployeeId = Number(employeeId);
            if (!Number.isInteger(normalizedEmployeeId) || normalizedEmployeeId <= 0) return;

            const sockets = getOrCreateSocketSet(normalizedEmployeeId);
            sockets.add(socket.id);
            socket.data.employeeId = normalizedEmployeeId;

            logger.info(
                {
                    employeeId: normalizedEmployeeId,
                    socketId: socket.id,
                    activeSocketCount: sockets.size,
                    event: "user_online"
                },
                "user_online"
            );

            // Broadcast the list of online employee IDs
            io.emit("online_users_list", Array.from(userSockets.keys()));
        });

        socket.on("typing_start", (data) => {
            // data: { conversationId, userId, userName }
            socket.broadcast.emit("user_typing", data);
        });

        socket.on("typing_stop", (data) => {
            // data: { conversationId, userId }
            socket.broadcast.emit("user_stopped_typing", data);
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
