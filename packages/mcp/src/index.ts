import { buildApp } from "./app.js";
import dotenv from "dotenv";

dotenv.config();

const start = async () => {
  try {
    const app = await buildApp();
    const port = Number(process.env.PORT || 3000);
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server listening on http://0.0.0.0:${port}`);
    });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
