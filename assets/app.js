/* Vendidito — generador local. Sin red, sin cuentas, sin telemetría. */
(() => {
  "use strict";

  const DATA = window.VL_DATA || { categories: [], conditions: [] };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const DRAFT_KEY = "Vendidito.draft.v1";

  const state = {
    titles: [],
    description: "",
    hashtags: [],
    price: null,
    category: null
  };

  const esc = (s) => String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const cap = (s) => {
    const v = clean(s);
    return v ? v.charAt(0).toUpperCase() + v.slice(1) : "";
  };
  const sentence = (s) => {
    const v = clean(s);
    if (!v) return "";
    return /[.!?]$/.test(v) ? v : v + ".";
  };
  const truncate = (s, max) => {
    const v = clean(s);
    return v.length > max ? v.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : v;
  };
  const slug = (s) => String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 22);

  const catById = (id) => DATA.categories.find((c) => c.id === id) || DATA.categories[0] || {
    id: "otros", label: "Otros", base: 20, tag: "segundamano", tip: "", hook: "", examples: ""
  };
  const condById = (id) => DATA.conditions.find((c) => c.id === id) || DATA.conditions[0] || {
    id: "muy_bueno", label: "Muy buen estado", short: "Muy buen estado", multiplier: 1, long: "Muy buen estado.", tag: "muybuenestado"
  };

  const PREMIUM = [
    "apple", "iphone", "ipad", "macbook", "samsung", "galaxy", "sony", "playstation", "nintendo", "switch", "xbox",
    "dyson", "bose", "garmin", "canon", "nikon", "the north face", "north face", "patagonia", "arc'teryx", "arcteryx",
    "levi's", "levis", "nike", "adidas", "new balance", "asics", "bosch", "siemens", "smeg", "miele", "vitra",
    "herman miller", "seiko", "casio", "marshall", "jbl", "sonos", "anker", "steam deck"
  ];
  const VALUE = [
    "shein", "primark", "h&m", "hm", "bershka", "pull&bear", "pull and bear", "stradivarius",
    "lefties", "temu", "decathlon", "quechua", "kiabi", "c&a"
  ];

  function brandMultiplier(text) {
    const n = String(text ?? "").toLowerCase();
    if (!n) return 1;
    if (PREMIUM.some((b) => n.includes(b))) return 1.22;
    if (VALUE.some((b) => n.includes(b))) return 0.88;
    return 1;
  }

  function nicePrice(n) {
    const v = Math.max(1, Number(n) || 1);
    if (v < 10) return Math.max(1, Math.round(v * 2) / 2);
    if (v < 50) return Math.round(v);
    if (v < 200) return Math.round(v / 5) * 5;
    return Math.round(v / 10) * 10;
  }

  const euro = (n) => new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0
  }).format(n);

  function estimatePrice({ catId, conditionId, brand, goal, min, max }) {
    const cat = catById(catId);
    const cond = condById(conditionId);
    const brandFactor = brandMultiplier(brand);
    const hasComps = Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min;
    let low, mid, high, basis;

    if (hasComps) {
      low = min;
      high = max;
      const spread = high - low;
      mid = goal === "rapido" ? low + spread * 0.3 : goal === "maximo" ? low + spread * 0.7 : (low + high) / 2;
      basis = "comparables";
    } else {
      const goalFactor = goal === "rapido" ? 0.82 : goal === "maximo" ? 1.18 : 1;
      mid = cat.base * cond.multiplier * brandFactor * goalFactor;
      low = mid * 0.82;
      high = mid * 1.18;
      basis = "categoria";
    }

    low = nicePrice(low);
    mid = nicePrice(mid);
    high = nicePrice(high);
    if (low >= mid) low = nicePrice(mid * 0.8);
    if (high <= mid) high = nicePrice(mid * 1.2);
    if (high <= low) high = nicePrice(low * 1.2);

    return { low, mid, high, basis, cat, cond, brandFactor };
  }

  function sizeLabel(catId, size) {
    const v = clean(size);
    if (!v) return "";
    if (/^(talla|medidas?|capacidad|edici[oó]n)\b/i.test(v)) return v;
    if (catId === "ropa" || catId === "calzado") return "talla " + v;
    if (catId === "moviles") return v;
    if (catId === "muebles" || catId === "bicis") return "medidas " + v;
    return v;
  }

  function titleOptions(data) {
    const cat = catById(data.cat);
    const cond = condById(data.condition);
    const item = clean(data.item);
    const brand = clean(data.brand);
    const model = clean(data.model);
    const color = clean(data.color);
    const size = sizeLabel(data.cat, data.size);
    const extras = clean(data.extras);
    const brandInItem = brand && item.toLowerCase().includes(brand.toLowerCase());
    const head = [brandInItem ? "" : brand, item, model].filter(Boolean).join(" ");
    const firstExtra = extras ? truncate(extras.split(/[,.;]/)[0], 34) : "";
    const condition = cond.short;

    const options = [
      [head, size, "—", condition].filter(Boolean).join(" "),
      [item, brandInItem ? "" : brand, color, size ? "· " + size : ""].filter(Boolean).join(" ") + " | " + condition,
      [head, firstExtra ? "· " + firstExtra : "", "—", condition].filter(Boolean).join(" ")
    ];

    return [...new Set(options.map((t) => truncate(t, 80)).filter(Boolean))].slice(0, 3);
  }

  function buildDescription(data) {
    const cat = catById(data.cat);
    const cond = condById(data.condition);
    const item = clean(data.item);
    const brand = clean(data.brand);
    const model = clean(data.model);
    const color = clean(data.color);
    const size = sizeLabel(data.cat, data.size);
    const defects = clean(data.defects);
    const extras = clean(data.extras);
    const zone = clean(data.zone);
    const platform = data.platform || "vinted";

    let stateLine = cond.long;
    if (defects) {
      if (cond.id === "nuevo") stateLine = "Nuevo con etiqueta, con el detalle indicado.";
      else if (cond.id === "como_nuevo") stateLine = "Como nuevo, salvo el detalle indicado.";
      else if (cond.id === "muy_bueno") stateLine = "Muy buen estado, con el detalle indicado.";
      else if (cond.id === "bueno") stateLine = "Buen estado, con signos normales de uso.";
    }

    const platformLine = platform === "wallapop"
      ? "Entrega en mano o envío a través de Wallapop. Escríbeme y lo concretamos."
      : platform === "ambas"
        ? "Puedes comprarlo por Vinted o Wallapop. Envío o entrega en mano, como prefieras."
        : "Envío a través de Vinted, con su protección de compra. Si tienes dudas, pregúntame antes.";

    const hook = cond.id === "piezas"
      ? "Se vende para piezas o reparación. Revisa bien las fotos y pregunta antes de comprar."
      : (cat.hook || "Un artículo cuidado y listo para una segunda vida.");

    const introBase = [
      item,
      brand && !item.toLowerCase().includes(brand.toLowerCase()) ? "de " + brand : "",
      model ? "(" + model + ")" : ""
    ].filter(Boolean).join(" ");
    const intro = introBase + (color ? ", en " + color : "");

    const lines = [
      hook,
      "",
      sentence(intro),
      size ? cap(size) + "." : "",
      "",
      "Estado: " + sentence(stateLine),
      defects ? "Detalles: " + sentence(defects) : "Revisa las fotos para ver el estado real. Si quieres, te mando más detalles.",
      extras ? "Incluye: " + sentence(extras) : "",
      zone ? "Zona: " + sentence(zone) : "",
      platformLine,
      "",
      "Cualquier duda, pregúntame sin compromiso. Respondo rápido."
    ];

    return lines.filter((l) => l !== null && l !== undefined).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function makeHashtags(data) {
    const cat = catById(data.cat);
    const cond = condById(data.condition);
    const platform = data.platform || "vinted";
    const tags = [
      platform === "wallapop" ? "#Wallapop" : "#Vinted",
      platform === "ambas" ? "#Wallapop" : "",
      "#" + cat.tag,
      data.brand ? "#" + slug(data.brand) : "",
      "#" + cond.tag,
      "#segundamano",
      (cat.id === "ropa" || cat.id === "calzado") ? "#modasostenible" : "",
      cat.id === "moviles" ? "#movil" : "",
      cat.id === "consolas" || cat.id === "videojuegos" ? "#gaming" : "",
      cat.id === "bicis" ? "#ciclismo" : "",
      cat.id === "muebles" ? "#decoracion" : ""
    ].filter(Boolean);
    return [...new Set(tags)].slice(0, 9);
  }

  function renderListing(data) {
    const resultEmpty = $("#result-empty");
    const resultContent = $("#result-content");
    if (!resultEmpty || !resultContent) return;

    const titles = titleOptions(data);
    const description = buildDescription(data);
    const hashtags = makeHashtags(data);
    const price = estimatePrice({
      catId: data.cat,
      conditionId: data.condition,
      brand: [data.brand, data.item].filter(Boolean).join(" "),
      goal: data.goal,
      min: Number(data.compsMin),
      max: Number(data.compsMax)
    });

    state.titles = titles;
    state.description = description;
    state.hashtags = hashtags;
    state.price = price;
    state.category = catById(data.cat);

    const priceNote = price.basis === "comparables"
      ? "Calculado a partir de los comparables que has introducido."
      : "Referencia por categoría, estado y marca. Añade comparables para afinar.";

    resultContent.innerHTML = `
      <div class="result-head">
        <strong>Anuncio listo</strong>
        <span class="result-privacy">${icon("lock")} Generado en tu navegador</span>
      </div>
      <div class="result-block">
        <h4>Tres títulos posibles</h4>
        ${titles.map((t) => `
          <div class="title-option">
            <p>${esc(t)}</p>
            <button type="button" class="copy-btn" data-copy="${esc(t)}" aria-label="Copiar título">${icon("copy")}</button>
          </div>`).join("")}
      </div>
      <div class="result-block">
        <h4>Descripción</h4>
        <p class="result-description">${esc(description)}</p>
        <div class="result-actions">
          <button type="button" class="button button-soft" data-copy="${esc(description)}">Copiar descripción</button>
          <button type="button" class="button button-soft" data-action="copy-all">Copiar todo</button>
          <button type="button" class="button button-soft" data-action="download">Descargar .txt</button>
        </div>
      </div>
      <div class="result-block">
        <h4>Precio orientativo</h4>
        <div class="price-box">
          <div class="price-main">${euro(price.mid)} <span>precio recomendado</span></div>
          <div class="price-tiers">
            <div class="price-tier"><span>Vender rápido</span><strong>${euro(price.low)}</strong></div>
            <div class="price-tier"><span>Precio justo</span><strong>${euro(price.mid)}</strong></div>
            <div class="price-tier"><span>Sin prisa</span><strong>${euro(price.high)}</strong></div>
          </div>
          <p class="price-note">${esc(priceNote)} No es una tasación: revisa anuncios similares antes de publicar.</p>
        </div>
      </div>
      <div class="result-block">
        <h4>Hashtags</h4>
        <div class="tags">${hashtags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
        <div class="result-actions">
          <button type="button" class="button button-soft" data-copy="${esc(hashtags.join(" "))}">Copiar hashtags</button>
        </div>
      </div>
      <div class="result-block">
        <h4>Antes de publicar</h4>
        <ul class="checklist">
          <li>${icon("check")} 4–6 fotos con luz natural y fondo limpio.</li>
          <li>${icon("check")} Mide o comprueba el artículo; no inventes medidas.</li>
          <li>${icon("check")} Revisa que el título tenga marca, modelo y talla.</li>
          <li>${icon("check")} Tapa datos personales, números de serie y direcciones en las fotos.</li>
          <li>${icon("check")} ${esc(catById(data.cat).tip)}</li>
        </ul>
        <div class="result-actions">
          <button type="button" class="button button-primary" data-action="save">Guardar borrador</button>
          <button type="button" class="button button-link" data-action="clear">Borrar todo</button>
        </div>
      </div>`;

    resultEmpty.hidden = true;
    resultContent.hidden = false;
    const panel = $("#result-panel");
    if (panel) {
      const rect = panel.getBoundingClientRect();
      if (rect.top < 72 || rect.bottom > window.innerHeight - 20) {
        const root = document.documentElement;
        const previous = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        window.scrollTo(0, Math.max(0, rect.top + window.scrollY - 72));
        root.style.scrollBehavior = previous;
      }
    }
  }

  function icon(name) {
    const icons = {
      lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg>',
      copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
      check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 12 5 5L20 6"/></svg>'
    };
    return icons[name] || "";
  }

  function toast(message) {
    let el = $(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    if (button) {
      button.classList.add("copied");
      setTimeout(() => button.classList.remove("copied"), 1500);
    }
    toast("Copiado");
  }

  function downloadText() {
    const parts = [
      state.titles[0] || "",
      "",
      state.description,
      "",
      state.hashtags.join(" "),
      "",
      state.price ? `Precio recomendado: ${euro(state.price.mid)} (rango ${euro(state.price.low)}–${euro(state.price.high)})` : ""
    ].filter(Boolean);
    const blob = new Blob([parts.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "anuncio-Vendidito.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Anuncio descargado");
  }

  function collect(form) {
    const value = (name) => form.elements.namedItem(name)?.value || "";
    return {
      cat: value("cat") || "ropa",
      item: value("item"),
      brand: value("brand"),
      model: value("model"),
      size: value("size"),
      color: value("color"),
      condition: value("condition") || "muy_bueno",
      platform: value("platform") || "vinted",
      goal: value("goal") || "equilibrio",
      zone: value("zone"),
      defects: value("defects"),
      extras: value("extras"),
      compsMin: value("compsMin"),
      compsMax: value("compsMax")
    };
  }

  function applyDraft(form, draft) {
    for (const [key, value] of Object.entries(draft)) {
      const field = form.elements.namedItem(key);
      if (field && "value" in field) field.value = value;
    }
  }

  function saveDraft(data) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
      toast("Borrador guardado en este dispositivo");
    } catch {
      toast("No se pudo guardar en este navegador");
    }
  }

  function readDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === "object" ? data : null;
    } catch {
      return null;
    }
  }

  function removeDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* sin ruido */ }
  }

  function showDraftBanner(form, draft) {
    if (!draft || !draft.item) return;
    const head = form.querySelector(".form-head");
    if (!head) return;
    const banner = document.createElement("div");
    banner.className = "draft-banner";
    banner.innerHTML = `<span>Tienes un borrador guardado en este dispositivo.</span>
      <span class="draft-actions"><button type="button" class="button button-soft" data-recover>Recuperar</button>
      <button type="button" class="button button-link" data-discard>Descartar</button></span>`;
    head.insertAdjacentElement("afterend", banner);
    banner.querySelector("[data-recover]").addEventListener("click", () => {
      applyDraft(form, draft);
      banner.remove();
      toast("Borrador recuperado");
    });
    banner.querySelector("[data-discard]").addEventListener("click", () => {
      removeDraft();
      banner.remove();
      toast("Borrador descartado");
    });
  }

  function initListingForm() {
    const form = $("#listing-form");
    if (!form) return;
    const itemInput = $("#item");

    showDraftBanner(form, readDraft());

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = collect(form);
      if (!clean(data.item)) {
        itemInput?.focus();
        itemInput?.setAttribute("aria-invalid", "true");
        toast("Escribe qué vendes para generar el anuncio");
        return;
      }
      itemInput?.removeAttribute("aria-invalid");
      renderListing(data);
    });

    itemInput?.addEventListener("input", () => itemInput.removeAttribute("aria-invalid"));

    $("#example-btn")?.addEventListener("click", () => {
      const set = (name, value) => {
        const field = form.elements.namedItem(name);
        if (field) field.value = value;
      };
      set("cat", "ropa");
      set("item", "Chaqueta vaquera");
      set("brand", "Levi's");
      set("model", "Trucker");
      set("size", "M");
      set("color", "Azul");
      set("condition", "muy_bueno");
      set("platform", "vinted");
      set("goal", "equilibrio");
      set("zone", "Madrid");
      set("defects", "Pequeño roce en el bajo de la manga izquierda");
      set("extras", "");
      set("compsMin", "24");
      set("compsMax", "32");
      renderListing(collect(form));
    });

    $("#clear-btn")?.addEventListener("click", () => {
      form.reset();
      removeDraft();
      $("#result-empty")?.removeAttribute("hidden");
      const content = $("#result-content");
      if (content) {
        content.hidden = true;
        content.innerHTML = "";
      }
      state.titles = [];
      state.description = "";
      state.hashtags = [];
      state.price = null;
      toast("Formulario y borrador borrados");
    });

    $("#result-content")?.addEventListener("click", (e) => {
      const target = e.target.closest("button");
      if (!target) return;
      if (target.dataset.copy) {
        copyText(target.dataset.copy, target);
        return;
      }
      const action = target.dataset.action;
      if (action === "copy-all") {
        copyText([state.titles[0], "", state.description, "", state.hashtags.join(" ")].filter(Boolean).join("\n"), target);
      } else if (action === "download") {
        downloadText();
      } else if (action === "save") {
        saveDraft(collect(form));
      } else if (action === "clear") {
        $("#clear-btn")?.click();
      }
    });
  }

  function initPriceForm() {
    const form = $("#price-form");
    const result = $("#price-result");
    if (!form || !result) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const price = estimatePrice({
        catId: $("#priceCat")?.value,
        conditionId: $("#priceCondition")?.value,
        brand: $("#priceBrand")?.value,
        goal: $("#priceGoal")?.value,
        min: Number($("#priceMin")?.value),
        max: Number($("#priceMax")?.value)
      });
      const basis = price.basis === "comparables"
        ? "Basado en los comparables que has introducido."
        : "Referencia por categoría, estado y marca. Añade dos comparables para afinar.";
      result.innerHTML = `
        <div class="price-empty">
          <div class="empty-icon">${icon("lock")}</div>
          <h3>Rango orientativo</h3>
          <p>${esc(price.cat.label)} · ${esc(price.cond.label)}</p>
        </div>
        <div class="price-main">${euro(price.mid)} <span>precio recomendado</span></div>
        <div class="price-tiers">
          <div class="price-tier"><span>Vender rápido</span><strong>${euro(price.low)}</strong></div>
          <div class="price-tier"><span>Precio justo</span><strong>${euro(price.mid)}</strong></div>
          <div class="price-tier"><span>Sin prisa</span><strong>${euro(price.high)}</strong></div>
        </div>
        <p class="price-explain">${esc(basis)} No es una tasación: revisa anuncios similares antes de publicar.</p>`;
    });
  }

  function init() {
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());
    initListingForm();
    initPriceForm();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
