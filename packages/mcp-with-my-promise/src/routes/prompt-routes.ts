import Router from "@koa/router";
import { PromptService } from "../services/prompt-service.js";
import { type AppContext } from "../app.js";

export const setupPromptRoutes = () => {
  const router = new Router<any, AppContext>({ prefix: "/prompts" });

  // List all prompts
  router.get("/", async (ctx) => {
    const promptService = new PromptService(ctx.db);
    const prompts = await promptService.findAll();
    ctx.body = prompts;
  });

  // Get prompt by ID
  router.get("/:id", async (ctx) => {
    const promptService = new PromptService(ctx.db);
    const prompt = await promptService.findById(ctx.params.id as string);
    if (!prompt) {
      ctx.status = 404;
      ctx.body = { error: "Prompt not found" };
      return;
    }
    ctx.body = prompt;
  });

  // Create prompt
  router.post("/", async (ctx) => {
    const promptService = new PromptService(ctx.db);
    const { name, description, content } = ctx.request.body as any;
    if (!name || !content) {
      ctx.status = 400;
      ctx.body = { error: "Name and content are required" };
      return;
    }
    const prompt = await promptService.create({ name, description, content });
    ctx.status = 201;
    ctx.body = prompt;
  });

  // Update prompt
  router.put("/:id", async (ctx) => {
    const promptService = new PromptService(ctx.db);
    const prompt = await promptService.update(
      ctx.params.id as string,
      ctx.request.body as any,
    );
    if (!prompt) {
      ctx.status = 404;
      ctx.body = { error: "Prompt not found" };
      return;
    }
    ctx.body = prompt;
  });

  // Delete prompt
  router.delete("/:id", async (ctx) => {
    const promptService = new PromptService(ctx.db);
    const success = await promptService.delete(ctx.params.id as string);
    if (!success) {
      ctx.status = 404;
      ctx.body = { error: "Prompt not found" };
      return;
    }
    ctx.status = 204;
  });

  return router;
};
