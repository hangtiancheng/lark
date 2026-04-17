import { TcpPool } from "./tcp-pool.js";

async function main() {
  const pool = new TcpPool({
    remoteHost: "127.0.0.1",
    remotePort: 9000,
    minConnections: 1,
    maxConnections: 5,
    expireTime: 30_000,
    sendTimeout: 3_000,
    retryDelay: 500,
  });

  const testCases = [
    { name: "echo", data: { cmd: "echo", data: "hello" } },
    { name: "delay-2s", data: { cmd: "delay", ms: 2000 } },
    { name: "hang-timeout", data: { cmd: "hang" } },
    { name: "drop-connection", data: { cmd: "drop" } },
    { name: "malformed-json", data: { cmd: "malformed" } },
    { name: "close-after-send", data: { cmd: "close-after-send" } },
  ];

  for (const testCase of testCases) {
    try {
      const payload = JSON.stringify(testCase.data) + "\r";
      const result = await pool.send(payload);
      console.log(`[${testCase.name}] success:`, result);
    } catch (err) {
      console.error(`[${testCase.name}] error:`, err);
    }
  }

  await pool.destroy();
}

main().catch(console.error);
