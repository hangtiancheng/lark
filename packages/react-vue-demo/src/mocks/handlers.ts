import { faker } from "@faker-js/faker";
import { delay, http, HttpResponse } from "msw";
import type { SearchResponse, SearchResult } from "@/types";

faker.seed(20260509);
faker.setDefaultRefDate("2026-05-09T00:00:00.000Z");

const categories = [
  "React",
  "Vue Reactivity",
  "Pinia",
  "VueUse",
  "Routing",
  "Performance",
  "Mock API",
];

const topics = [
  "defineComponent",
  "useSetup",
  "createSetup",
  "watch",
  "computed",
  "keyboard shortcut",
  "mock service worker",
  "faker",
  "tailwind css",
  "daisyUI",
  "lucide icons",
  "react router",
];

const pages = ["/", "/demo"];

const searchItems: SearchResult[] = Array.from({ length: 10_000 }, (_, index) => {
  const topic = faker.helpers.arrayElement(topics);
  const category = faker.helpers.arrayElement(categories);
  const title = `${faker.hacker.verb()} ${topic} ${faker.hacker.noun()}`;
  const tags = faker.helpers.arrayElements(topics, { min: 2, max: 5 });

  return {
    id: faker.string.uuid(),
    title: `${title[0]?.toUpperCase() ?? ""}${title.slice(1)}`,
    description: faker.helpers.arrayElement([
      `Quickly locate ${topic} capabilities and examples in the react-vue demo.`,
      `${topic} usage notes, interaction details, and implementation entry points for ${category}.`,
      `Explore how ${topic} works with React, Vue reactivity, and mocked data flows.`,
    ]),
    category,
    url: index % 3 === 0 ? "/demo" : faker.helpers.arrayElement(pages),
    tags,
    updatedAt: faker.date.recent({ days: 30 }).toISOString(),
  };
});

function rankItem(item: SearchResult, words: string[]) {
  const title = item.title.toLowerCase();
  const description = item.description.toLowerCase();
  const category = item.category.toLowerCase();
  const tags = item.tags.join(" ").toLowerCase();

  return words.reduce((score, word) => {
    if (title.includes(word)) return score + 8;
    if (category.includes(word)) return score + 5;
    if (tags.includes(word)) return score + 3;
    if (description.includes(word)) return score + 1;
    return score;
  }, 0);
}

export const handlers = [
  http.get("/api/search", async ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";
    const normalizedQuery = query.toLowerCase();

    await delay(faker.number.int({ min: 280, max: 780 }));

    if (normalizedQuery.includes("error")) {
      return HttpResponse.json(
        {
          message: "Simulated network failure. Please use the retry action.",
        },
        { status: 503 },
      );
    }

    const words = normalizedQuery.split(/\s+/).filter(Boolean);
    const rankedItems = searchItems
      .map((item) => ({
        item,
        score: words.length === 0 ? 1 : rankItem(item, words),
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score)
      .map(({ item }) => item);

    const response: SearchResponse = {
      items: rankedItems.slice(0, 8),
      total: rankedItems.length,
      query,
    };

    return HttpResponse.json(response);
  }),
];
