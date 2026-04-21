import { Server } from "socket.io";
import logger from "../logger.js";

const onlineUsers = new Map(); // employee_id -> socket_id

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
            if (!employeeId) return;
            onlineUsers.set(Number(employeeId), socket.id);
            logger.info({ employeeId, event: "user_online" }, "user_online");
            // Broadcast the list of online employee IDs
            io.emit("online_users_list", Array.from(onlineUsers.keys()));
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
            for (const [employeeId, socketId] of onlineUsers.entries()) {
                if (socketId === socket.id) {
                    onlineUsers.delete(employeeId);
                    logger.info({ employeeId, event: "user_offline" }, "user_offline");
                    break;
                }
            }
            io.emit("online_users_list", Array.from(onlineUsers.keys()));
            logger.info({ socketId: socket.id }, "Socket disconnected");
        });
    });

    return io;
}
