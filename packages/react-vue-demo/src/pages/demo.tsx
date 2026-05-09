import { useState } from "react";
import { Link } from "react-router";
import Counter from "@/components/demo/counter";
import Counter2 from "@/components/demo/counter2";
import Counter3 from "@/components/demo/counter3";
import { Pinia as Pinia1 } from "@/pinia/pinia-a";
import { Pinia as Pinia2 } from "@/pinia/pinia-b";
import { Mouse } from "@/hooks/use-mouse";
import { Battery } from "@/hooks/use-battery";
import { Query } from "@/hooks/use-query";

function Demo() {
  const [count, setCount] = useState(0);
  const [show, setShow] = useState(true);

  return (
    <main className="bg-base-200 min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <nav className="navbar px-0">
          <div className="navbar-start">
            <Link to="/" className="btn btn-ghost px-0 text-xl">
              react-vue
            </Link>
          </div>
          <div className="navbar-end">
            <Link to="/" className="btn btn-ghost">
              Search
            </Link>
          </div>
        </nav>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl tracking-tight">Demo</h1>
            <p className="text-base-content/60 mt-2 text-sm">
              React components backed by Vue reactivity.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="btn btn-primary btn-soft"
          >
            {show ? "Unmount Counter" : "Mount Counter"}
          </button>
        </div>

        <div className="space-y-6">
          <section className="card border-base-300 bg-base-100 border shadow-sm">
            <div className="card-body">
              <h2 className="card-title">Components</h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {show ? (
                  <Counter setValue={setCount} value={count} />
                ) : (
                  <div className="border-base-300 text-base-content/50 flex min-h-64 items-center justify-center rounded-2xl border border-dashed text-sm">
                    Counter is unmounted.
                  </div>
                )}
                <Counter2 value={count} setValue={setCount} />
                <Counter3 value={count} setValue={setCount} />
              </div>
            </div>
          </section>

          <section className="card border-base-300 bg-base-100 border shadow-sm">
            <div className="card-body">
              <h2 className="card-title">Pinia</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Pinia1 />
                <Pinia2 />
              </div>
            </div>
          </section>

          <section className="card border-base-300 bg-base-100 border shadow-sm">
            <div className="card-body">
              <h2 className="card-title">VueUse</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Mouse />
                <Battery />
              </div>
            </div>
          </section>

          <section className="card border-base-300 bg-base-100 border shadow-sm">
            <div className="card-body">
              <h2 className="card-title">useFetch</h2>
              <Query />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default Demo;
