const $ = (selector) => document.querySelector(selector);
const config = window.MIRRORLOOP_CONFIG ?? { apiBaseURL: "", shopEnabled: false };
const state = { catalog: [], cart: new Set(), filter: "all" };
let lastFocused = null;

function productCard(item) {
  const article = document.createElement("article");
  article.className = `product-card product-${item.edition}`;
  article.dataset.edition = item.edition;
  article.innerHTML = `
    <img src="${item.image}" width="480" height="720" loading="lazy" alt="Preview from ${item.title}, ${item.subtitle}">
    <div class="product-copy">
      <p class="product-kind">${item.kind === "arc" ? `ARC ${item.arcCode} · 12 CARDS` : "COMPLETE COLLECTION"}</p>
      <h3>${item.title}</h3>
      <strong class="product-edition">${item.subtitle}</strong>
      <p>${item.description}</p>
      <div class="product-action">
        <strong>Price shown at Stripe</strong>
        <button class="button button-quiet add-button" type="button" data-sku="${item.sku}" aria-pressed="false">Add to cart</button>
      </div>
    </div>`;
  article.querySelector(".add-button").addEventListener("click", () => toggleItem(item.sku));
  return article;
}

function renderProducts() {
  const collections = state.catalog.filter((item) => item.kind !== "arc");
  const arcs = state.catalog.filter((item) =>
    item.kind === "arc" && (state.filter === "all" || item.edition === state.filter)
  );
  $("#collection-grid").replaceChildren(...collections.map(productCard));
  $("#arc-grid").replaceChildren(...arcs.map(productCard));
  syncButtons();
}

function syncButtons() {
  document.querySelectorAll(".add-button").forEach((button) => {
    const selected = state.cart.has(button.dataset.sku);
    button.setAttribute("aria-pressed", String(selected));
    button.textContent = selected ? "Remove" : "Add to cart";
    button.classList.toggle("selected", selected);
  });
}

function toggleItem(sku) {
  if (state.cart.has(sku)) state.cart.delete(sku);
  else state.cart.add(sku);
  persistCart();
  renderCart();
}

function persistCart() {
  try {
    localStorage.setItem("mirrorloop-cart-v1", JSON.stringify([...state.cart]));
  } catch {
    // A cart still works for this page view when storage is unavailable.
  }
}

function restoreCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("mirrorloop-cart-v1") || "[]");
    state.cart = new Set(saved.filter((sku) => state.catalog.some((item) => item.sku === sku)));
  } catch {
    state.cart = new Set();
  }
}

function renderCart() {
  const items = state.catalog.filter((item) => state.cart.has(item.sku));
  $("#cart-count").textContent = String(items.length);
  $("#cart-count").setAttribute("aria-label", `${items.length} ${items.length === 1 ? "item" : "items"}`);
  const container = $("#cart-items");
  if (!items.length) {
    container.innerHTML = `<div class="empty-cart"><strong>Your cart is empty.</strong><p>Choose an ARC or a complete edition to begin.</p></div>`;
  } else {
    container.replaceChildren(...items.map((item) => {
      const row = document.createElement("article");
      row.className = "cart-item";
      row.innerHTML = `
        <img src="${item.image}" width="64" height="96" alt="">
        <div><strong>${item.title}</strong><span>${item.subtitle}</span></div>
        <div><span>Price at Stripe</span><button type="button" data-remove="${item.sku}">Remove</button></div>`;
      row.querySelector("[data-remove]").addEventListener("click", () => toggleItem(item.sku));
      return row;
    }));
  }
  $("#checkout-button").disabled = !items.length || !config.shopEnabled;
  $("#checkout-status").textContent = config.shopEnabled
    ? ""
    : "Checkout is being connected. Your selections will remain in this browser.";
  syncButtons();
}

function openCart() {
  lastFocused = document.activeElement;
  $("#cart-panel").hidden = false;
  $("#cart-button").setAttribute("aria-expanded", "true");
  document.body.classList.add("cart-open");
  $(".cart-close").focus();
}

function closeCart() {
  $("#cart-panel").hidden = true;
  $("#cart-button").setAttribute("aria-expanded", "false");
  document.body.classList.remove("cart-open");
  lastFocused?.focus();
}

async function checkout() {
  if (!state.cart.size || !config.shopEnabled) return;
  const button = $("#checkout-button");
  const status = $("#checkout-status");
  button.disabled = true;
  button.textContent = "Opening Stripe…";
  status.textContent = "";
  try {
    const response = await fetch(`${config.apiBaseURL}/v1/checkout-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [...state.cart] }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || "Secure checkout could not be opened.");
    }
    window.location.assign(payload.url);
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
    button.textContent = "Try secure checkout again";
  }
}

async function start() {
  const response = await fetch("/data/shop.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("The collection could not be loaded.");
  const data = await response.json();
  state.catalog = data.items;
  restoreCart();
  renderProducts();
  renderCart();
  const checkoutState = new URLSearchParams(location.search).get("checkout");
  if (checkoutState === "success") {
    state.cart.clear();
    persistCart();
    renderCart();
    $("#checkout-status").textContent = "Checkout returned from Stripe. If payment completed, Stripe will send your receipt and MIRROR//LOOP will email you while your files are prepared.";
    openCart();
  } else if (checkoutState === "cancelled") {
    $("#checkout-status").textContent = "Checkout was cancelled. Your cart is still here.";
    openCart();
  }
}

$("#cart-button").addEventListener("click", openCart);
document.querySelectorAll("[data-close-cart]").forEach((button) => button.addEventListener("click", closeCart));
$("#checkout-button").addEventListener("click", checkout);
document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.edition;
    document.querySelectorAll(".filter-button").forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle("selected", selected);
      candidate.setAttribute("aria-pressed", String(selected));
    });
    renderProducts();
  });
});
document.addEventListener("keydown", (event) => {
  const panel = $("#cart-panel");
  if (panel.hidden) return;
  if (event.key === "Escape") {
    closeCart();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...panel.querySelectorAll(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

start().catch((error) => {
  $("#arc-grid").innerHTML = `<p class="form-status">${error.message}</p>`;
});
