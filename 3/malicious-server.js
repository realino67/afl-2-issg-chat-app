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

let realName = "";
let displayName = "";

const signPayload = (sender, msg) =>
  crypto.sign("sha256", Buffer.from(`${sender}|${msg}`), keys.privateKey).toString("base64");

const checkSignature = (sender, msg, sig) => {
  const pubKey = directory.get(sender);
  if (!pubKey || !sig) return false;
  try {
    return crypto.verify("sha256", Buffer.from(`${sender}|${msg}`), pubKey, Buffer.from(sig, "base64"));
  } catch {
    return false;
  }
};

socket.on("connect", () => {
  console.log("Connected to the server");
  cli.question("Enter your username: ", (answer) => {
    realName = displayName = answer.trim();
    directory.set(realName, myPublicPem);
    console.log(`Welcome, ${realName} to the chat`);
    socket.emit("registerPublicKey", { username: realName, publicKey: myPublicPem });
    cli.prompt();
  });
});

cli.on("line", (input) => {
  const clean = input.trim();
  if (!clean) return cli.prompt();

  if (clean.startsWith("!impersonate ")) {
    displayName = clean.slice(13).trim();
    console.log(`Now impersonating as ${displayName}`);
  } else if (clean === "!exit") {
    displayName = realName;
    console.log(`Now you are ${displayName}`);
  } else {
    socket.emit("message", {
      username: displayName,
      message: clean,
      signature: signPayload(displayName, clean),
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

socket.on("message", ({ username, message, signature }) => {
  if (username === displayName) return;

  const valid = checkSignature(username, message, signature);
  console.log(
    valid
      ? `${username}: ${message}`
      : `${username}: ${message} -> [WARNING: this user is fake]`
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