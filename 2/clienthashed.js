const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

let username = "";

function generateHash(content) {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => {
    username = input.trim();
    console.log(`Welcome, ${username} to the chat`);
    rl.prompt();

    rl.on("line", (line) => {
      const text = line.trim();
      if (text) {
        socket.emit("message", {
          username,
          message: text,
          digest: generateHash(text),
        });
      }
      rl.prompt();
    });
  });
});

socket.on("message", (data) => {
  const { username: sender, message: body, digest } = data;
  if (sender === username) return;

  const expectedHash = generateHash(body);
  if (digest && expectedHash === digest) {
    console.log(`${sender}: ${body}`);
  } else {
    console.log(`[ALERT] Message integrity check failed! ${sender}: ${body}`);
  }
  rl.prompt();
});

socket.on("disconnect", () => {
  console.log("Server disconnected, Exiting...");
  rl.close();
  process.exit(0);
});

rl.on("SIGINT", () => {
  console.log("\nExiting...");
  socket.disconnect();
  rl.close();
  process.exit(0);
});