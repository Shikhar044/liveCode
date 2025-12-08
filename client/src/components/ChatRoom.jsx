import Editor from "@monaco-editor/react";
import React, { useEffect, useState, useRef } from "react";
import { socket } from "../utils/socket";
import UserList from "./UserList";

function ChatRoom({ username, room, onLeave }) {
  const [users, setUsers] = useState([]);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("cpp");
  const [typingUser, setTypingUser] = useState(null);

  const messagesRef = useRef();

  /*******************************
   * ROOM JOIN + REALTIME LISTENERS
   *******************************/
  useEffect(() => {
    console.log("⚡ ChatRoom mounted, socket id:", socket.id);

    // ⭐ JOIN ROOM ONCE (no connect listener)
    socket.emit("join-room", { room, username });

    // ⭐ USER LIST
    socket.on("room-users", (list) => {
      setUsers(list);
    });

    // ⭐ REALTIME CODE
    socket.on("receive-code", (updatedCode) => {
      setCode(updatedCode);
    });

    // ⭐ REALTIME LANGUAGE
    socket.on("receive-language", (newLang) => {
      setLanguage(newLang);
    });

    // ⭐ TYPING INDICATOR
    socket.on("typing-started", (user) => {
      if (user !== username) setTypingUser(user);
    });

    socket.on("typing-stopped", () => {
      setTypingUser(null);
    });

    /*******************************
     * CLEANUP — IMPORTANT!
     *******************************/
    return () => {
      console.log("🔻 Cleaning ChatRoom listeners…");

      socket.off("room-users");
      socket.off("receive-code");
      socket.off("receive-language");
      socket.off("typing-started");
      socket.off("typing-stopped");

      // ⭐ IMPORTANT — NO DISCONNECT HERE
      // ⭐ socket remains alive globally
    };
  }, [room, username]);

  /*******************************
   * DEBOUNCED CODE SENDING + TYPING EVENTS
   *******************************/
  let debounceTimer = null;
  let typingTimeout = null;

  const handleCodeChange = (value) => {
    const updated = value ?? "";
    setCode(updated);

    // ⭐ USER IS TYPING NOTIFICATION
    socket.emit("typing-started", { room, username });

    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("typing-stopped", { room, username });
    }, 800);

    // ⭐ DEBOUNCED REALTIME CODE SEND
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      socket.emit("code-change", { room, code: updated });
    }, 250);
  };

  /*******************************
   * UI
   *******************************/
  return (
    <div className="grid grid-cols-12 h-screen overflow-hidden">
      {/* LEFT: EDITOR */}
      <div className="col-span-9 p-6 flex flex-col h-full">
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-lg">#{room}</h3>
            <p className="text-slate-300 text-sm">
              Logged in as <span className="text-accent">{username}</span>
            </p>
          </div>

          {/* LANGUAGE SELECT */}
          <div className="flex items-center gap-2">
            <span className="text-white text-sm">Language:</span>
            <select
              className="border rounded px-2 py-1 bg-slate-900 text-white text-sm"
              value={language}
              onChange={(e) => {
                const newLang = e.target.value;
                setLanguage(newLang);
                socket.emit("language-change", { room, language: newLang });
              }}
            >
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="c">C</option>
            </select>
          </div>

          {/* LEAVE ROOM */}
          <button
            onClick={() => {
              console.log("🚪 User leaving room:", username);

              // ⭐ ORDER IMPORTANT
              socket.emit("leave-room", { room, username });
              socket.emit("manual-leave", room);

              onLeave(); // navigate away
            }}
            className="px-3 py-1 rounded bg-slate-700 text-white hover:bg-slate-600"
          >
            Leave
          </button>
        </div>

        {/* EDITOR */}
        <div className="flex-1 border border-slate-700 rounded-lg overflow-hidden mt-2">
          {/* Typing Indicator */}
          {typingUser && (
            <div className="text-xs text-green-400 mb-1 px-2">
              {typingUser} is typing…
            </div>
          )}

          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={handleCodeChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              automaticLayout: true,
              fontSize: 14,
            }}
          />
        </div>
      </div>

      {/* RIGHT: ACTIVE USERS */}
      <div className="col-span-3 border-l border-slate-700 bg-slate-900/20">
        <UserList users={users} />
      </div>
    </div>
  );
}

export default ChatRoom;
