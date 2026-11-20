const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

const keyPair = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

let registeredUsername = "";
let username = "";
const users = new Map();

function createMessageSignature(sender, text) {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${sender}:${text}`);
  signer.end();
  return signer.sign(keyPair.privateKey, "hex");
}

function isSignatureValid(sender, text, signature) {
  const senderPublicKey = users.get(sender);
  if (!senderPublicKey || !signature) return false;

  try {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${sender}:${text}`);
    verifier.end();
    return verifier.verify(senderPublicKey, signature, "hex");
  } catch {
    return false;
  }
}

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => {
    username = input.trim();
    registeredUsername = username;
    console.log(`Welcome, ${username} to the chat`);

    users.set(username, keyPair.publicKey);
    socket.emit("registerPublicKey", {
      username,
      publicKey: keyPair.publicKey,
    });
    rl.prompt();

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        rl.prompt();
        return;
      }

      const impersonateMatch = trimmed.match(/^!impersonate (\w+)$/);
      if (impersonateMatch) {
        username = impersonateMatch[1];
        console.log(`Now impersonating as ${username}`);
      } else if (trimmed === "!exit") {
        username = registeredUsername;
        console.log(`Now you are ${username}`);
      } else {
        const signature = createMessageSignature(username, trimmed);
        socket.emit("message", {
          username,
          message: trimmed,
          signature,
        });
      }
      rl.prompt();
    });
  });
});

socket.on("init", (entries) => {
  entries.forEach(([user, key]) => users.set(user, key));
  console.log(`\nThere are currently ${users.size} users in the chat`);
  rl.prompt();
});

socket.on("newUser", ({ username: newUser, publicKey }) => {
  users.set(newUser, publicKey);
  console.log(`${newUser} joined the chat`);
  rl.prompt();
});

socket.on("message", ({ username: sender, message: text, signature }) => {
  if (sender === username) return;

  const authentic = isSignatureValid(sender, text, signature);
  if (authentic) {
    console.log(`${sender}: ${text}`);
  } else {
    console.log(`${sender}: ${text} -> [WARNING: this user is fake]`);
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