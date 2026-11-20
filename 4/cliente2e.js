const io = require("socket.io-client");
const readline = require("readline");
const crypto = require("crypto");

const socket = io("http://localhost:3000");
const cli = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

const keys = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const myPublicPem = keys.publicKey.export({ type: "spki", format: "pem" });
const directory = new Map();

let currentUser = "";
let recipient = "";

const sealMessage = (target, plainText) =>
  crypto.publicEncrypt(directory.get(target), Buffer.from(plainText)).toString("base64");

const unsealMessage = (cipherText) => {
  try {
    return crypto.privateDecrypt(keys.privateKey, Buffer.from(cipherText, "base64")).toString("utf8");
  } catch {
    return null;
  }
};

socket.on("connect", () => {
  console.log("Connected to the server");
  cli.question("Enter your username: ", (answer) => {
    currentUser = answer.trim();
    directory.set(currentUser, myPublicPem);
    console.log(`Welcome, ${currentUser} to the chat`);
    socket.emit("registerPublicKey", { username: currentUser, publicKey: myPublicPem });
    cli.prompt();
  });
});

cli.on("line", (input) => {
  const clean = input.trim();
  if (!clean) return cli.prompt();

  if (clean.startsWith("!secret ")) {
    recipient = clean.slice(8).trim();
    console.log(`Now secretly chatting with ${recipient}`);
  } else if (clean === "!exit") {
    console.log(`No more secretly chatting with ${recipient}`);
    recipient = "";
  } else if (recipient && directory.has(recipient)) {
    socket.emit("message", {
      username: currentUser,
      message: sealMessage(recipient, clean),
      encrypted: true,
    });
  } else {
    socket.emit("message", {
      username: currentUser,
      message: clean,
      encrypted: false,
    });
  }
  cli.prompt();
});

socket.on("init", (list) => {
  list.forEach(([user, key]) => directory.set(user, key));
  console.log(`\nThere are currently ${directory.size} users in the chat`);
  cli.prompt();
});

socket.on("newUser", ({ username, publicKey }) => {
  directory.set(username, publicKey);
  console.log(`${username} joined the chat`);
  cli.prompt();
});

socket.on("message", ({ username, message, encrypted }) => {
  if (username === currentUser) return;

  if (encrypted) {
    const opened = unsealMessage(message);
    console.log(opened ? `${username} (secret): ${opened}` : `${username}: ${message}`);
  } else {
    console.log(`${username}: ${message}`);
  }
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