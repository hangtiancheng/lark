import { defineComponent } from "@lark/react-vue";
import { RouterProvider } from "react-router";
import router from "./router";

const App = defineComponent(
  () => ({}),
  () => <RouterProvider router={router} />,
);

export default App;
