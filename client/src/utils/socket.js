import { io } from "socket.io-client";

export const socket = io("http://localhost:4000", {
  autoConnect: true,
  transports: ["websocket"],
});

socket.on("connect", () => {
  console.log("🌐 Global socket connected:", socket.id);
});
