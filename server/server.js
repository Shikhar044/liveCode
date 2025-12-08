const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// In-memory store: { roomName: { socketId: { username } } }
const rooms = {};
//to store the latest code for each room
const roomCode = {};

io.on("connection", (socket) => {
  console.log("client connected:", socket.id);

  {
    /*Client sends "code-change"
  Server listens
  Server sends "receive-code" to all other users in the same room */
  }
  socket.on("code-change", ({ room, code }) => {
    console.log(
      "💻 SERVER GOT CODE:",
      code?.slice(0, 20),
      "FROM:",
      socket.id,
      "ROOM:",
      room
    );
    roomCode[room] = code; // this will store the latest room code
    socket.to(room).emit("receive-code", code);
  });

  {
    /*till here only rest is previous one*/
  }

  console.log("socket connected:", socket.id);

  socket.on("join-room", ({ room, username }, callback) => {
    console.log("🚪 join-room:", room, "user:", username, "socket:", socket.id);

    socket.join(room);
    socket.data.username = username;
    socket.data.room = room;

    rooms[room] = rooms[room] || {};
    rooms[room][socket.id] = { username };
    // If room already has code, send it only to this user
    if (roomCode[room]) {
      socket.emit("receive-code", roomCode[room]);
    }

    // notify users in room about updated userlist
    const users = Object.values(rooms[room]).map((u) => u.username);
    io.to(room).emit("room-users", users);

    // welcome message to this user
    socket.emit("message", {
      from: "system",
      text: `Welcome ${username} — you joined ${room}.`,
      ts: Date.now(),
    });

    // notify others
    socket.to(room).emit("message", {
      from: "system",
      text: `${username} has joined the room.`,
      ts: Date.now(),
    });

    //update server handlers for presence of user
    socket.on("typing-started", ({ room, username }) => {
      socket.to(room).emit("typing-started", username);
    });

    socket.on("typing-stopped", ({ room, username }) => {
      socket.to(room).emit("typing-stopped", username);
    });

    callback && callback({ ok: true });
  });

  socket.on("send-message", ({ room, text }) => {
    const username = socket.data.username || "Unknown";
    const msg = { from: username, text, ts: Date.now() };
    io.to(room).emit("message", msg);
  });

  //updating server listener for language update
  socket.on("language-change", ({ room, language }) => {
    socket.to(room).emit("receive-language", language);
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    const username = socket.data.username;
    console.log("❌ disconnect:", socket.id, "room:", room, "user:", username);

    if (room && rooms[room]) {
      delete rooms[room][socket.id];
      const users = Object.values(rooms[room]).map((u) => u.username);
      io.to(room).emit("room-users", users);

      socket.to(room).emit("message", {
        from: "system",
        text: `${username} left the room.`,
        ts: Date.now(),
      });

      if (Object.keys(rooms[room]).length === 0) {
        delete rooms[room];
      }
    }
    //console.log('socket disconnected:', socket.id);
  });

  socket.on("manual-leave", (room) => {
    console.log("⚡ manual leave:", socket.id, room);
    socket.leave(room);
  });

  socket.on("leave-room", ({ room, username }) => {
    console.log("⚡ leave-room:", socket.id, room);

    if (rooms[room] && rooms[room][socket.id]) {
      delete rooms[room][socket.id];

      const users = Object.values(rooms[room]).map((u) => u.username);
      io.to(room).emit("room-users", users);

      socket.to(room).emit("message", {
        from: "system",
        text: `${username} left the room.`,
        ts: Date.now(),
      });

      // delete room if empty
      if (Object.keys(rooms[room]).length === 0) {
        delete rooms[room];
      }
    }
  });

  // optional: create-room (server side can accept new rooms)
  socket.on("create-room", ({ roomName }, cb) => {
    rooms[roomName] = rooms[roomName] || {};
    cb && cb({ ok: true });
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Socket server running on :${PORT}`));
