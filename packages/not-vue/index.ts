import {
  type ChangeRecord,
  type ComputedMap,
  MiniVue,
  type MiniVueOptions,
  type MiniVuePublicInstance,
} from "./vendor.js";

interface CartItem {
  id: number;
  name: string;
  price: number;
  count: number;
  meta: {
    checked: boolean;
  };
  lastAddedAt: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
}

interface AppState {
  title: string;
  isActive: boolean;
  avatarUrl: string;
  avatarName: string;
  imageIndex: number;
  cart: CartItem[];
}

interface AppPublicInstance extends MiniVuePublicInstance<AppState> {
  cartHTML: string;
  summaryText: string;
  changeLogHTML: string;
  onTitleClick(): void;
  onImgClick(): void;
  addToCart(productId: number): void;
  addFirst(): void;
  addSecond(): void;
}

interface AppMethods {
  onTitleClick(this: AppPublicInstance): void;
  onImgClick(this: AppPublicInstance): void;
  addToCart(this: AppPublicInstance, productId: number): void;
  addFirst(this: AppPublicInstance): void;
  addSecond(this: AppPublicInstance): void;
}

interface AppComputed extends ComputedMap<AppPublicInstance> {
  cartHTML(this: AppPublicInstance): string;
  summaryText(this: AppPublicInstance): string;
  changeLogHTML(this: AppPublicInstance): string;
}

function formatReadableTime(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

const images: {
  name: string;
  src: string;
}[] = [
  { name: "vue", src: "./vue.svg" },
  { name: "react", src: "./react.svg" },
  { name: "vite", src: "./vite.svg" },
];

const products: Product[] = [
  { id: 1, name: "Product 1", price: 10 },
  { id: 2, name: "Product 2", price: 20 },
];

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatChangeLogHTML(changes: ChangeRecord[]): string {
  if (changes.length === 0) {
    return '<div class="text-green-300">No batched changes yet.</div>';
  }

  const itemsHTML = changes
    .map((change, index) => {
      const nextValue =
        typeof change.newValue === "object" && change.newValue !== null
          ? JSON.stringify(change.newValue)
          : String(change.newValue);

      return [
        '<li class="border-b border-slate-600/60 py-2 last:border-b-0">',
        `<div class="text-xs uppercase tracking-wide text-slate-300">#${index + 1} ${escapeHTML(change.type)}</div>`,
        `<div class="mt-1 text-sm text-emerald-300">${escapeHTML(change.path)}</div>`,
        `<div class="mt-1 break-all text-xs text-slate-200">${escapeHTML(nextValue)}</div>`,
        "</li>",
      ].join("");
    })
    .join("");

  return `<ol class="m-0 list-none p-0">${itemsHTML}</ol>`;
}

const appMethods: AppMethods = {
  onTitleClick() {
    this.isActive = !this.isActive;
    this.imageIndex = (this.imageIndex + 1) % images.length;
    this.avatarUrl = images[this.imageIndex].src;
    this.avatarName = images[this.imageIndex].name;
    this.title = this.isActive ? "MiniVue Cart Demo" : "MiniVue Collapsed Demo";
  },
  onImgClick() {
    this.title = `Runtime Title ${formatReadableTime()}`;
  },
  addToCart(productId: number) {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    const existing = this.cart.find((item) => item.id === productId);
    if (existing) {
      existing.count += 1;
      existing.lastAddedAt = formatReadableTime();
      return;
    }

    this.cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      count: 1,
      meta: {
        checked: true,
      },
      lastAddedAt: formatReadableTime(),
    });
  },
  addFirst() {
    this.addToCart(1);
  },
  addSecond() {
    this.addToCart(2);
  },
};

const appComputed: AppComputed = {
  cartHTML() {
    return this.cart
      .map(
        (item) =>
          `<div class="cart-item border-b border-dashed border-slate-200 py-2 last:border-b-0">${item.name}: ${item.count} item(s)</div>`,
      )
      .join("");
  },
  summaryText() {
    const totalCount = this.cart.reduce((sum, item) => sum + item.count, 0);
    const totalPrice = this.cart.reduce(
      (sum, item) => sum + item.count * item.price,
      0,
    );

    return `Total: ${totalCount} item(s), CNY ${totalPrice}`;
  },
  changeLogHTML() {
    return formatChangeLogHTML(this.$changes);
  },
};

const appOptions: MiniVueOptions<
  AppState,
  AppPublicInstance,
  AppMethods,
  AppComputed
> = {
  el: "#app",
  data: {
    title: "MiniVue Demo",
    isActive: true,
    avatarUrl: images[0].src,
    avatarName: images[0].name,
    imageIndex: 0,
    cart: [],
  },
  methods: appMethods,
  computed: appComputed,
  template: `
  <!-- TEMPLATE -->
      `,
};

window.app = new MiniVue<AppState, AppPublicInstance, AppMethods, AppComputed>(
  appOptions,
);

declare global {
  interface Window {
    app?: MiniVue<AppState, AppPublicInstance, AppMethods, AppComputed>;
  }
}
