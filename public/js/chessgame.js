const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const chatMessages = document.getElementById("chatMessages");

let draggedPiece = null;
let sourceSquare = null;
let playerRole = null;
let currentRoom = null;

const renderBoard = () => {
  const board = chess.board();
  boardElement.innerHTML = "";
  board.forEach((row, rowindex) => {
    row.forEach((square, sqareindex) => {
      const squareElement = document.createElement("div");
      squareElement.classList.add(
        "square",
        (rowindex + sqareindex) % 2 === 1 ? "light" : "dark"
      );
      squareElement.dataset.row = rowindex;
      squareElement.dataset.col = sqareindex;

      if (square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add(
          "piece",
          square.color === "w" ? "white" : "black"
        );
        pieceElement.innerText = getPieceUnicode(square);
        pieceElement.draggable = playerRole === square.color;

        pieceElement.addEventListener("dragstart", (e) => {
          if (pieceElement.draggable) {
            draggedPiece = pieceElement;
            sourceSquare = {
              row: rowindex,
              col: sqareindex,
            };
            e.dataTransfer.setData("text/plain", "");
          }
        });

        pieceElement.addEventListener("dragend", (e) => {
          draggedPiece = null;
          sourceSquare = null;
        });
        squareElement.appendChild(pieceElement);
      }

      squareElement.addEventListener("dragover", function (e) {
        e.preventDefault();
      });

      squareElement.addEventListener("drop", function (e) {
        e.preventDefault();
        if (draggedPiece) {
          const targetSource = {
            row: parseInt(squareElement.dataset.row),
            col: parseInt(squareElement.dataset.col),
          };

          handleMove(sourceSquare, targetSource);
        }
      });
      boardElement.appendChild(squareElement);
    });
  });
  if (playerRole === "b") {
    boardElement.classList.add("flipped");
  } else {
    boardElement.classList.remove("flipped");
  }
};

const handleMove = (source, target) => {
  const move = {
    from: String.fromCharCode(97 + source.col) + (8 - source.row),
    to: String.fromCharCode(97 + target.col) + (8 - target.row),
    promotion: "q",
  };
  socket.emit("move", move, currentRoom);
};

const getPieceUnicode = (piece) => {
  const unicodePieces = {
    p: "\u2659",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚",
    P: "\u2659",
    N: "♘",
    B: "♗",
    R: "♖",
    Q: "♕",
    K: "♔",
  };

  return unicodePieces[piece.type] || "";
};

socket.on("waitingForOpponent", function () {
  document.getElementById("waitingScreen").style.display = "flex";
  document.getElementById("gameScreen").style.display = "none";
});

socket.on("startGame", function (role, roomID) {
  playerRole = role;
  currentRoom = roomID;

  document.getElementById("waitingMessage").textContent = "You are playing as " + (role === "w" ? "White" : "Black");

  setTimeout(() => {
    document.getElementById("waitingScreen").style.display = "none";
    document.getElementById("gameScreen").style.display = "flex";
    renderBoard();
  }, 2000);
});

socket.on("invalidMove", function (move) {
  alert("Invalid move!");
});

socket.on("gameOver", function () {
  alert("Game over! Opponent disconnected.");
});

socket.on("boardState", function (fen) {
  chess.load(fen);
  renderBoard();
});

socket.on("move", function (move) {
  chess.move(move);
  renderBoard();
});

socket.on("check", function (turn) {
  const checkMessage = turn === playerRole ? "You are in check!" : "Your opponent is in check!";
  alert(checkMessage);
});

socket.on("checkmate", function (result) {
  if (result === "win") {
    window.location.href = "/win";
  } else if (result === "lose") {
    window.location.href = "/lose";
  }
});

// Handle sending chat messages
chatForm.addEventListener("submit", function(e) {
  e.preventDefault();
  if (chatInput.value) {
    const message = { text: chatInput.value, sender: playerRole };
    socket.emit("chatMessage", message, currentRoom);
    chatInput.value = "";
  }
});

// Handle receiving chat messages
socket.on("chatMessage", function(msg) {
  const sender = msg.sender === playerRole ? "You" : "Player";
  const item = document.createElement("p");
  item.textContent = `${sender}: ${msg.text}`;
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll to the bottom
});

renderBoard();
