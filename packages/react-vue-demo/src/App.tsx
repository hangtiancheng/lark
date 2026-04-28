import { useState } from "react";
import "./main.css";
import Counter from "./components/counter";
import Counter2 from "./components/counter2";
import Counter3 from "./components/counter3";
import { Pinia as Pinia1 } from "./pinia/pinia-a";
import { Pinia as Pinia2 } from "./pinia/pinia-b";
import { Mouse } from "./hooks/use-mouse";
import { Battery } from "./hooks/use-battery";
import { Query } from "./hooks/use-query";

function App() {
  const [count, setCount] = useState(0);
  const [show, setShow] = useState(true);

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10 font-sans">
      <div className="text-4xl font-extrabold tracking-tight text-sky-900 mb-8 mx-1">
        <span className="text-sky-400">react vue</span> demo
      </div>

      <button onClick={() => setShow(!show)} className="mb-6 px-6 py-2">
        Toggle Component
      </button>

      <div className="space-y-12">
        <section>
          <h2 className="flex items-center gap-2">Components</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {show ? <Counter setValue={setCount} value={count} /> : null}
            <Counter2 value={count} setValue={setCount} />
            <Counter3 value={count} setValue={setCount} />
          </div>
        </section>

        <section>
          <h2 className="flex items-center gap-2">Pinia</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Pinia1 />
            <Pinia2 />
          </div>
        </section>

        <section>
          <h2 className="flex items-center gap-2">VueUse</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Mouse />
            <Battery />
          </div>
        </section>

        <section>
          <h2 className="flex items-center gap-2">useFetch (REST)</h2>
          <div className="grid grid-cols-1 gap-4">
            <Query />
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
