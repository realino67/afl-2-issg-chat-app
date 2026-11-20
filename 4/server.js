const { createServer } = require("http");
const { Server } = require("socket.io");

const io = new Server(createServer().listen(3000, () => {
  console.log("Server running on port 3000");
}));

const publicKeyStore = new Map();

io.on("connection", (client) => {
  console.log(`Client ${client.id} connected`);
  client.emit("init", Array.from(publicKeyStore.entries()));

  client.on("registerPublicKey", ({ username, publicKey }) => {
    publicKeyStore.set(username, publicKey);
    console.log(`${username} registered with public key.`);
    io.emit("newUser", { username, publicKey });
  });

  client.on("message", (packet) => io.emit("message", packet));
  client.on("disconnect", () => console.log(`Client ${client.id} disconnected`));
});