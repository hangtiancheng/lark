import Demo from "@/pages/demo";
import Home from "@/pages/home";

import { createBrowserRouter } from "react-router";

const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/demo",
    Component: Demo,
  },
]);

export default router;
