import Koa from "koa";
import serve from "koa-static";
import { MongoClient, Db } from "mongodb";
import path from "path";
import { fileURLToPath } from "url";
import { setupPromptRoutes } from "./routes/prompt-routes.js";
import { setupMcpRoutes } from "./mcp.js";
import bodyParser from "@koa/bodyparser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AppContext extends Koa.Context {
  db: Db;
}
export interface AppInstance extends Koa<Koa.DefaultState, AppContext> {
  mongoClient: MongoClient;
}

export const buildApp = async (): Promise<AppInstance> => {
  const app = new Koa<Koa.DefaultState, AppContext>() as AppInstance;

  // Setup MongoDB
  const defaultMongoUrl =
    "mongodb://root:pass@localhost:27017/db0?authSource=admin";
  const client = new MongoClient(process.env.MONGO_URL || defaultMongoUrl);
  await client.connect();
  const db = client.db();

  // Inject db into context
  app.context.db = db;

  // Middleware
  app.use(bodyParser());

  // Serve static files from client folder
  app.use(serve(path.join(__dirname, "./client")));

  // Setup Routes
  const promptRouter = setupPromptRoutes();
  const mcpRouter = setupMcpRoutes();

  app.use(promptRouter.routes()).use(promptRouter.allowedMethods());
  app.use(mcpRouter.routes()).use(mcpRouter.allowedMethods());

  // Attach the mongo client so we can close it later if needed
  app.mongoClient = client;

  return app;
};
