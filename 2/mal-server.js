const { createServer } = require("http");
const { Server } = require("socket.io");

const io = new Server(createServer().listen(3000, () => {
  console.log("Server running on port 3000");
}));

io.on("connection", (client) => {
  console.log(`Client ${client.id} connected`);

  client.on("message", (packet) => {
    io.emit("message", { ...packet, message: `${packet.message} (sus?)` });
  });

  client.on("disconnect", () => console.log(`Client ${client.id} disconnected`));
});