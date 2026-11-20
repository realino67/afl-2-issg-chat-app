const io = require("socket.io-client");
const readline = require("readline");
const { createHash } = require("crypto");

const socket = io("http://localhost:3000");
const cli = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

let currentUser = "";
const digest = (str) => createHash("sha256").update(str).digest("hex");

socket.on("connect", () => {
  console.log("Connected to the server");
  cli.question("Enter your username: ", (answer) => {
    currentUser = answer.trim();
    console.log(`Welcome, ${currentUser} to the chat`);
    cli.prompt();
  });
});

cli.on("line", (input) => {
  const cleanMsg = input.trim();
  if (cleanMsg) {
    socket.emit("message", {
      username: currentUser,
      message: cleanMsg,
      checksum: digest(cleanMsg),
    });
  }
  cli.prompt();
});

socket.on("message", ({ username, message, checksum }) => {
  if (username === currentUser) return;

  const isIntact = checksum === digest(message);
  console.log(
    isIntact
      ? `${username}: ${message}`
      : `[ALERT] Message integrity check failed! ${username}: ${message}`
  );
  cli.prompt();
});

const quit = (msg) => {
  console.log(msg);
  socket.disconnect();
  cli.close();
  process.exit(0);
};

socket.on("disconnect", () => quit("Server disconnected, Exiting..."));
cli.on("SIGINT", () => quit("\nExiting..."));