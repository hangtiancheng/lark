import Router from "@koa/router";
import { type AppContext } from "../app.js";

export const setupOncallRoutes = () => {
  const router = new Router<unknown, AppContext>({ prefix: "/oncall" });

  router.post("/", async (ctx) => {
    console.error(
      "[Oncall] Diagnostic Report:",
      JSON.stringify(ctx.request.body, null, 2),
    );
    ctx.status = 200;
    ctx.body = { ok: true };
  });

  return router;
};
