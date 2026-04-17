import autocannon from "autocannon";
import { buildApp } from "../src/app.js";

async function run() {
  try {
    const app = await buildApp();
    const server = app.listen(3000, "0.0.0.0", () => {
      console.log("Server started for benchmarking on port 3000");
    });

    const instance = autocannon(
      {
        url: "http://localhost:3000/prompts",
        connections: 10,
        pipelining: 1,
        duration: 10,
      },
      (err, result) => {
        if (err) {
          console.error("Benchmark failed:", err);
        } else {
          console.log("Benchmark results:");
          console.log(`Requests/sec: ${result.requests.average}`);
          console.log(`Latency (ms): ${result.latency.average}`);
          console.log(`Throughput (bytes/sec): ${result.throughput.average}`);
          console.log(`Total Requests: ${result.requests.total}`);
        }
        server.close();
        if (app.mongoClient) {
          app.mongoClient.close();
        }
        process.exit(0);
      },
    );

    autocannon.track(instance, { renderProgressBar: true });
  } catch (err) {
    console.error(
      "Failed to start server for benchmark. Ensure MongoDB is running at mongodb://localhost:27017/db0",
      err,
    );
    process.exit(1);
  }
}

run();
