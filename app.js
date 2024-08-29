const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = socket(server);

let waitingPlayer = null; // Track waiting player
let rooms = {}; // Store active rooms

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index", { title: "Chess" });
});

app.get("/win", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "win.html"));
});

app.get("/lose", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "lose.html"));
});

io.on("connection", (socket) => {
  console.log("A user connected");

  if (waitingPlayer) {
    // Pair the waiting player with the new player
    const roomID = socket.id + "#" + waitingPlayer.id;
    rooms[roomID] = { players: [waitingPlayer, socket], chess: new Chess() };

    // Assign roles and start the game
    waitingPlayer.join(roomID);
    socket.join(roomID);

    waitingPlayer.emit("startGame", "w", roomID);
    socket.emit("startGame", "b", roomID);

    // Clear waiting player
    waitingPlayer = null;
  } else {
    // No waiting player, set the current player as waiting
    waitingPlayer = socket;
    socket.emit("waitingForOpponent");
  }

  socket.on("move", (move, roomID) => {
    const gameRoom = rooms[roomID];
    if (!gameRoom) return;

    const chess = gameRoom.chess;

    try {
      if (chess.turn() === "w" && socket.id !== gameRoom.players[0].id) return;
      if (chess.turn() === "b" && socket.id !== gameRoom.players[1].id) return;

      const result = chess.move(move);
      if (result) {
        io.to(roomID).emit("move", move);
        io.to(roomID).emit("boardState", chess.fen());

        // Check for checkmate
        if (chess.isCheckmate()) {
          const winnerSocketID = chess.turn() === "w" ? gameRoom.players[1].id : gameRoom.players[0].id;
          const loserSocketID = chess.turn() === "w" ? gameRoom.players[0].id : gameRoom.players[1].id;

          io.to(winnerSocketID).emit("checkmate", "win");
          io.to(loserSocketID).emit("checkmate", "lose");
        } else if (chess.isCheck()) {
          io.to(roomID).emit("check", chess.turn());
        }
      } else {
        socket.emit("invalidMove", move);
      }
    } catch (err) {
      console.error("Invalid move or error:", err.message);
      socket.emit("invalidMove", move);
    }
  });

  socket.on("chatMessage", (msg, roomID) => {
    io.to(roomID).emit("chatMessage", msg);
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected");

    if (waitingPlayer === socket) {
      waitingPlayer = null;
    } else {
      for (const roomID in rooms) {
        const room = rooms[roomID];
        if (room.players.includes(socket)) {
          delete rooms[roomID];
          io.to(roomID).emit("message", "Opponent disconnected. Game over.");
          io.to(roomID).emit("gameOver");
          break;
        }
      }
    }
  });
});

server.listen(3000, function () {
  console.log("Listening on port 3000");
});
