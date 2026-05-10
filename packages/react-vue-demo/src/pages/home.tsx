import { defineComponent } from "@lark/react-vue";
import { Link } from "react-router";
import { GlobalSearch } from "@/components/search/global-search";

const Home = defineComponent(
  () => ({}),
  () => (
    <main className="bg-base-200 min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-6 sm:px-6">
        <nav className="navbar px-0">
          <div className="navbar-start">
            <Link to="/" className="btn btn-ghost px-0 text-xl">
              react-vue
            </Link>
          </div>
          <div className="navbar-end">
            <Link to="/demo" className="btn btn-ghost">
              Demo
            </Link>
          </div>
        </nav>

        <section className="flex flex-1 items-center py-16">
          <div className="w-full space-y-8">
            <div className="space-y-3 text-center">
              <h1 className="text-4xl tracking-tight md:text-5xl">
                Global Search
              </h1>
              <p className="text-base-content/60 mx-auto max-w-xl text-sm leading-6">
                Press Cmd/Ctrl + P, type a query, and open a result.
              </p>
            </div>

            <GlobalSearch cacheTtlSeconds={30} />
          </div>
        </section>
      </div>
    </main>
  ),
);

export default Home;
