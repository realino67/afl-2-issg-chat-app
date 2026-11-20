const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

const socket = io("http://localhost:3000");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

let username = "";
let targetUsername = "";
const users = new Map();

function encryptMessage(plainText, recipientPublicKey) {
  const encryptedBuffer = crypto.publicEncrypt(
    {
      key: recipientPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(plainText, "utf8")
  );
  return encryptedBuffer.toString("base64");
}

function decryptMessage(cipherBase64) {
  const decryptedBuffer = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(cipherBase64, "base64")
  );
  return decryptedBuffer.toString("utf8");
}

socket.on("connect", () => {
  console.log("Connected to the server");

  rl.question("Enter your username: ", (input) => {
    username = input.trim();
    console.log(`Welcome, ${username} to the chat`);

    users.set(username, publicKey);
    socket.emit("registerPublicKey", { username, publicKey });
    rl.prompt();

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        rl.prompt();
        return;
      }

      const secretMatch = trimmed.match(/^!secret (\w+)$/);
      if (secretMatch) {
        const candidate = secretMatch[1];
        if (!users.has(candidate)) {
          console.log(`User "${candidate}" is not registered.`);
        } else {
          targetUsername = candidate;
          console.log(`Now secretly chatting with ${targetUsername}`);
        }
      } else if (trimmed === "!exit") {
        console.log(`No more secretly chatting with ${targetUsername}`);
        targetUsername = "";
      } else if (targetUsername) {
        const recipientKey = users.get(targetUsername);
        const cipherText = encryptMessage(trimmed, recipientKey);
        socket.emit("message", {
          username,
          recipient: targetUsername,
          message: cipherText,
        });
      } else {
        socket.emit("message", {
          username,
          recipient: null,
          message: trimmed,
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

socket.on("newUser", ({ username: newUser, publicKey: newKey }) => {
  users.set(newUser, newKey);
  console.log(`${newUser} joined the chat`);
  rl.prompt();
});

socket.on("message", ({ username: sender, recipient, message }) => {
  if (sender === username) return;

  if (!recipient) {
    console.log(`${sender}: ${message}`);
  } else if (recipient === username) {
    try {
      const plainText = decryptMessage(message);
      console.log(`${sender} [Secret]: ${plainText}`);
    } catch {
      console.log(`${sender}: [Failed to decrypt message]`);
    }
  } else {
    console.log(`${sender}: ${message}`);
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