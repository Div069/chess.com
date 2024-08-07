const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");
const { title } = require("process");

const app = express();
const server = http.createServer(app);

const io = socket(server);

const chess = new Chess();

let players = {};
let currentPlayer = "w";
let connectedPlayers = 0;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index", { title: "Chess" });
});

io.on("connection", function (uniquesocket) {
  console.log("a user connected");

  if (!players.white) {
    players.white = uniquesocket.id;
    uniquesocket.emit("playerRole", "w");
  } else if (!players.black) {
    players.black = uniquesocket.id;
    uniquesocket.emit("playerRole", "b");
  } else {
    uniquesocket.emit("spectator");
  }

  uniquesocket.on("disconnect", function () {
    console.log("a user disconnected");
    if (uniquesocket.id === players.white) {
      delete players.white;
    } else if (uniquesocket.id === players.black) {
      delete players.black;
    }
  });

  uniquesocket.on("move", (move) => {
    try {
      if (chess.turn() === "w" && uniquesocket.id != players.white) return;
      if (chess.turn() === "b" && uniquesocket.id != players.black) return;

      const result = chess.move(move);
      if (result) {
        currentPlayer = chess.turn();
        io.emit("move", move);
        io.emit("boadState", chess.fen());
      } else {
        console.log("invalid move", move);
        uniquesocket.emit("invalidMove1", move);
      }
    } catch (err) {
      console.log(err);
      uniquesocket.emit("invalidMove", move);
    }
  });
});

server.listen(3000, function () {
  console.log("Listening on port 3000");
});
