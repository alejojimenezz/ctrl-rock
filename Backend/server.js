const http = require("http");
const net = require("net");
const tls = require("tls");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

loadDotEnv(path.join(__dirname, ".env"));

const PORT = Number(process.env.PORT || 3000);
const MELI_SITE_ID = process.env.MELI_SITE_ID || "MCO";
const MELI_ACCESS_TOKEN = process.env.MELI_ACCESS_TOKEN || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "ctrl-rock-admin";
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || "cotizaciones@ctrl-rock.local";
const SMTP_SECURE = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
const QUOTE_EMAIL_DRY_RUN = String(process.env.QUOTE_EMAIL_DRY_RUN || "").toLowerCase() === "true";

const ROOT_DIR = path.resolve(__dirname, "..");
const FRONTEND_DIR = path.join(ROOT_DIR, "Frontend");
const REPORTS_DIR = path.join(__dirname, "private", "cost-reports");
const SENT_QUOTES_DIR = path.join(__dirname, "private", "sent-quotes");

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Worker-Token"
};

const FALLBACK_PRICES_COP = {
  caobaBody: 260000,
  fresnoBody: 230000,
  arceBody: 240000,
  neck: 160000,
  fretboard: 95000,
  humbuckerPickups: 220000,
  singlecoilPickups: 180000,
  bridgeChrome: 95000,
  bridgeGold: 135000,
  bridgeBlack: 115000,
  tunersChrome: 85000,
  tunersGold: 125000,
  tunersBlack: 105000,
  strings: 35000,
  finish: 70000
};

const LABELS = {
  wood: {
    caoba: "Caoba",
    fresno: "Fresno",
    arce: "Arce"
  },
  finish: {
    cherry: "Rojo cereza",
    natural: "Natural",
    sunburst: "Sunburst",
    negro: "Negro mate",
    goldtop: "Oro vintage"
  },
  hardware: {
    chrome: "Cromo",
    gold: "Oro",
    black: "Negro"
  },
  pickups: {
    humbucker: "Humbucker",
    singlecoil: "Single coil"
  }
};

const SEARCH_TERMS = {
  wood: {
    caoba: "bloque madera caoba guitarra electrica cuerpo",
    fresno: "bloque madera fresno guitarra electrica cuerpo",
    arce: "bloque madera arce guitarra electrica cuerpo"
  },
  finish: {
    cherry: "laca pintura guitarra rojo cereza",
    natural: "laca transparente guitarra madera",
    sunburst: "pintura guitarra sunburst",
    negro: "pintura guitarra negro mate",
    goldtop: "pintura guitarra dorado metalizado"
  },
  hardware: {
    chrome: "cromo",
    gold: "dorado",
    black: "negro"
  },
  pickups: {
    humbucker: "set pastillas humbucker guitarra electrica",
    singlecoil: "set pastillas single coil guitarra electrica"
  }
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

async function main() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.mkdir(SENT_QUOTES_DIR, { recursive: true });

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        return send(res, 204, "", JSON_HEADERS);
      }

      const requestUrl = new URL(req.url, `http://${req.headers.host}`);

      if (requestUrl.pathname === "/api/health" && req.method === "GET") {
        return sendJson(res, 200, {
          ok: true,
          service: "ctrl-rock-costs",
          mercadoLibreSite: MELI_SITE_ID,
          mercadoLibreTokenConfigured: Boolean(MELI_ACCESS_TOKEN),
          smtpConfigured: hasSmtpConfigured(),
          quoteEmailDryRun: QUOTE_EMAIL_DRY_RUN
        });
      }

      if (requestUrl.pathname === "/api/costs/reports" && req.method === "POST") {
        const payload = await readJson(req);
        const report = await createCostReport(payload);
        return sendJson(res, 201, {
          ok: true,
          reportId: report.id,
          generatedAt: report.generatedAt,
          totalMaterialsCost: report.totalMaterialsCost,
          currency: report.currency,
          materialCount: report.materials.length,
          internalReportPath: report.files.html
        });
      }

      if (requestUrl.pathname === "/api/quotes/send" && req.method === "POST") {
        const payload = await readJson(req);
        const result = await sendQuoteToCustomer(payload);
        return sendJson(res, 201, result);
      }

      if (requestUrl.pathname === "/api/admin/reports" && req.method === "GET") {
        if (!isWorkerAuthorized(req, requestUrl)) return sendJson(res, 401, { ok: false, error: "Unauthorized" });
        return sendJson(res, 200, { ok: true, reports: await listReports() });
      }

      if (requestUrl.pathname === "/admin/reports" && req.method === "GET") {
        if (!isWorkerAuthorized(req, requestUrl)) return sendHtml(res, 401, "<h1>Unauthorized</h1>");
        return sendHtml(res, 200, await renderReportIndex(requestUrl));
      }

      const reportMatch = requestUrl.pathname.match(/^\/admin\/reports\/([a-zA-Z0-9_-]+)$/);
      if (reportMatch && req.method === "GET") {
        if (!isWorkerAuthorized(req, requestUrl)) return sendHtml(res, 401, "<h1>Unauthorized</h1>");
        return servePrivateReport(res, reportMatch[1]);
      }

      return serveStaticFrontend(req, res, requestUrl);
    } catch (error) {
      console.error(error);
      return sendJson(res, error.statusCode || 500, {
        ok: false,
        error: error.message || "Internal server error"
      });
    }
  });

  server.listen(PORT, () => {
    console.log(`Ctrl + Rock API running at http://localhost:${PORT}`);
    console.log(`Worker reports: http://localhost:${PORT}/admin/reports?token=${ADMIN_TOKEN}`);
  });
}

async function createCostReport(payload) {
  const config = normalizeConfig(payload);
  const materials = buildMaterials(config);
  const quotedMaterials = [];

  for (const material of materials) {
    const quote = await quoteMaterial(material);
    quotedMaterials.push({
      ...material,
      selectedOffer: quote.offer,
      unitPrice: quote.offer?.price || material.fallbackPrice,
      subtotal: (quote.offer?.price || material.fallbackPrice) * material.quantity,
      source: quote.source,
      searchUrl: quote.searchUrl,
      checkedAt: new Date().toISOString()
    });
  }

  const id = makeReportId();
  const generatedAt = new Date().toISOString();
  const totalMaterialsCost = quotedMaterials.reduce((sum, item) => sum + item.subtotal, 0);
  const report = {
    id,
    generatedAt,
    currency: "COP",
    mercadoLibre: {
      siteId: MELI_SITE_ID,
      tokenConfigured: Boolean(MELI_ACCESS_TOKEN),
      note: "Prices are references from live search when available; fallback catalog values are used if live search fails."
    },
    customer: config.customer,
    guitar: config.guitar,
    totalMaterialsCost,
    materials: quotedMaterials
  };

  const files = await writeReportFiles(report);
  return { ...report, files };
}

async function sendQuoteToCustomer(payload) {
  const config = normalizeConfig(payload);
  if (!isValidEmail(config.customer.email)) {
    const error = new Error("El correo del cliente no es valido.");
    error.statusCode = 400;
    throw error;
  }

  const attachmentsPayload = payload?.attachments && typeof payload.attachments === "object" ? payload.attachments : {};
  const pdfBase64 = cleanBase64(attachmentsPayload.pdfBase64);
  if (!pdfBase64) {
    const error = new Error("La cotizacion debe incluir un PDF en base64.");
    error.statusCode = 400;
    throw error;
  }

  const report = await createCostReport({
    customer: config.customer,
    guitar: config.guitar
  });

  const quoteId = makeQuoteId();
  const modelImageBase64 = cleanBase64(attachmentsPayload.modelImageBase64);
  const subject = `Tu cotizacion Ctrl + Rock - ${config.guitar.model}`;
  const html = renderCustomerEmailHtml(config, report);
  const text = renderCustomerEmailText(config, report);
  const attachments = [
    {
      filename: `cotizacion-${quoteId}.pdf`,
      contentType: "application/pdf",
      content: Buffer.from(pdfBase64, "base64")
    }
  ];

  if (modelImageBase64) {
    attachments.push({
      filename: `modelo-${quoteId}.png`,
      contentType: "image/png",
      content: Buffer.from(modelImageBase64, "base64")
    });
  }

  const smtpConfigured = hasSmtpConfigured();
  const emailMode = smtpConfigured && !QUOTE_EMAIL_DRY_RUN ? "smtp" : "dry_run";

  if (emailMode === "smtp") {
    await sendSmtpMail({
      from: SMTP_FROM,
      to: config.customer.email,
      subject,
      text,
      html,
      attachments
    });
  }

  await writeSentQuoteReceipt({
    id: quoteId,
    reportId: report.id,
    generatedAt: new Date().toISOString(),
    emailMode,
    emailSent: emailMode === "smtp",
    customer: config.customer,
    guitar: config.guitar,
    attachments: attachments.map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.content.length
    }))
  });

  return {
    ok: true,
    quoteId,
    reportId: report.id,
    emailSent: emailMode === "smtp",
    emailMode,
    customerEmail: config.customer.email,
    totalMaterialsCost: report.totalMaterialsCost,
    currency: report.currency
  };
}

function normalizeConfig(payload) {
  const body = payload && typeof payload === "object" ? payload : {};
  const guitar = body.guitar && typeof body.guitar === "object" ? body.guitar : {};
  const customer = body.customer && typeof body.customer === "object" ? body.customer : {};
  const dimensions = guitar.dimensions && typeof guitar.dimensions === "object" ? guitar.dimensions : {};

  return {
    customer: {
      idType: cleanText(customer.idType),
      idNumber: cleanText(customer.idNumber),
      name: cleanText(customer.name),
      phone: cleanText(customer.phone),
      email: cleanText(customer.email)
    },
    guitar: {
      model: cleanText(guitar.model) || "Strat",
      mode: cleanText(guitar.mode) || "experto",
      description: cleanText(guitar.description),
      wood: oneOf(guitar.wood, ["caoba", "fresno", "arce"], "caoba"),
      finish: oneOf(guitar.finish, ["cherry", "natural", "sunburst", "negro", "goldtop"], "cherry"),
      hardware: oneOf(guitar.hardware, ["chrome", "gold", "black"], "chrome"),
      pickups: oneOf(guitar.pickups, ["humbucker", "singlecoil"], "humbucker"),
      dimensions: {
        bodyLength: toNumber(dimensions.bodyLength, 360),
        bodyWidth: toNumber(dimensions.bodyWidth, 280),
        bodyThickness: toNumber(dimensions.bodyThickness, 40),
        scaleLength: toNumber(dimensions.scaleLength, 648)
      }
    }
  };
}

function buildMaterials(config) {
  const { wood, finish, hardware, pickups, dimensions } = config.guitar;
  const bodyFallbackKey = `${wood}Body`;
  const bridgeFallbackKey = `bridge${capitalize(hardware)}`;
  const tunersFallbackKey = `tuners${capitalize(hardware)}`;
  const pickupFallbackKey = pickups === "singlecoil" ? "singlecoilPickups" : "humbuckerPickups";
  const approxBodyVolumeCm3 = Math.round((dimensions.bodyLength * dimensions.bodyWidth * dimensions.bodyThickness) / 1000);

  return [
    {
      code: "BODY_BLANK",
      name: `Madera para cuerpo (${LABELS.wood[wood]})`,
      quantity: 1,
      unit: "pieza",
      query: SEARCH_TERMS.wood[wood],
      notes: `Volumen CAD aproximado: ${approxBodyVolumeCm3} cm3`,
      fallbackPrice: FALLBACK_PRICES_COP[bodyFallbackKey]
    },
    {
      code: "NECK",
      name: "Mastil de guitarra electrica",
      quantity: 1,
      unit: "pieza",
      query: "mastil guitarra electrica arce",
      notes: `Escala: ${dimensions.scaleLength} mm`,
      fallbackPrice: FALLBACK_PRICES_COP.neck
    },
    {
      code: "FRETBOARD",
      name: "Diapason",
      quantity: 1,
      unit: "pieza",
      query: "diapason guitarra electrica palo rosa",
      notes: "Referencia para ensamble del mastil",
      fallbackPrice: FALLBACK_PRICES_COP.fretboard
    },
    {
      code: "PICKUPS",
      name: `Pastillas ${LABELS.pickups[pickups]}`,
      quantity: 1,
      unit: "set",
      query: SEARCH_TERMS.pickups[pickups],
      notes: pickups === "singlecoil" ? "Set tipo SSS" : "Set tipo HH",
      fallbackPrice: FALLBACK_PRICES_COP[pickupFallbackKey]
    },
    {
      code: "BRIDGE",
      name: `Puente (${LABELS.hardware[hardware]})`,
      quantity: 1,
      unit: "pieza",
      query: `puente guitarra electrica ${SEARCH_TERMS.hardware[hardware]}`,
      notes: "Compatible con guitarra electrica",
      fallbackPrice: FALLBACK_PRICES_COP[bridgeFallbackKey]
    },
    {
      code: "TUNERS",
      name: `Clavijas (${LABELS.hardware[hardware]})`,
      quantity: 1,
      unit: "set",
      query: `clavijas guitarra electrica ${SEARCH_TERMS.hardware[hardware]}`,
      notes: "Set de 6 unidades",
      fallbackPrice: FALLBACK_PRICES_COP[tunersFallbackKey]
    },
    {
      code: "STRINGS",
      name: "Cuerdas",
      quantity: 1,
      unit: "set",
      query: "cuerdas guitarra electrica calibre 10",
      notes: "Set inicial de prueba",
      fallbackPrice: FALLBACK_PRICES_COP.strings
    },
    {
      code: "FINISH",
      name: `Acabado (${LABELS.finish[finish]})`,
      quantity: 1,
      unit: "kit",
      query: SEARCH_TERMS.finish[finish],
      notes: "Pintura, laca o sellador de referencia",
      fallbackPrice: FALLBACK_PRICES_COP.finish
    }
  ];
}

async function quoteMaterial(material) {
  const apiQuote = await searchMercadoLibreApi(material.query);
  if (apiQuote.offer) return apiQuote;

  const scrapeQuote = await scrapeMercadoLibreSearch(material.query);
  if (scrapeQuote.offer) return scrapeQuote;

  return {
    source: "fallback_catalog",
    offer: {
      title: "Valor referencial interno",
      price: material.fallbackPrice,
      currency: "COP",
      link: "",
      seller: ""
    },
    searchUrl: buildMeliSearchUrl(material.query)
  };
}

async function searchMercadoLibreApi(query) {
  const apiUrl = new URL(`https://api.mercadolibre.com/sites/${MELI_SITE_ID}/search`);
  apiUrl.searchParams.set("q", query);
  apiUrl.searchParams.set("limit", "25");
  apiUrl.searchParams.set("sort", "price_asc");

  const headers = { Accept: "application/json" };
  if (MELI_ACCESS_TOKEN) headers.Authorization = `Bearer ${MELI_ACCESS_TOKEN}`;

  try {
    const response = await fetch(apiUrl, { headers });
    if (!response.ok) throw new Error(`MercadoLibre API ${response.status}`);
    const data = await response.json();
    const offer = selectOffer((data.results || []).map((item) => ({
      title: item.title,
      price: Number(item.price),
      currency: item.currency_id || "COP",
      link: item.permalink,
      seller: item.seller?.nickname || "",
      condition: item.condition || "",
      shipping: summarizeShipping(item.shipping),
      sellerCountry: item.seller_address?.country?.id || item.address?.country_id || "",
      isInternational: isInternationalMeliItem(item),
      isLocal: isLocalMeliItem(item)
    })));

    return {
      source: "mercadolibre_api",
      offer,
      searchUrl: apiUrl.toString()
    };
  } catch (error) {
    return { source: "mercadolibre_api_error", offer: null, searchUrl: apiUrl.toString(), error: error.message };
  }
}

async function scrapeMercadoLibreSearch(query) {
  const searchUrl = buildMeliSearchUrl(query);

  try {
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CtrlRockCostBot/0.1; +https://localhost)",
        Accept: "text/html,application/xhtml+xml"
      }
    });
    if (!response.ok) throw new Error(`MercadoLibre page ${response.status}`);
    const html = await response.text();
    const offers = extractOffersFromHtml(html);
    const offer = selectOffer(offers);
    return { source: offer ? "mercadolibre_scrape" : "mercadolibre_scrape_empty", offer, searchUrl };
  } catch (error) {
    return { source: "mercadolibre_scrape_error", offer: null, searchUrl, error: error.message };
  }
}

function extractOffersFromHtml(html) {
  const offers = [];

  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = JSON.parse(unescapeHtml(match[1]).trim());
      const items = json.itemListElement || json.offers || [];
      for (const item of Array.isArray(items) ? items : [items]) {
        const product = item.item || item;
        const offer = product.offers || item.offers || {};
        offers.push({
          title: product.name || item.name,
          price: Number(offer.price || item.price),
          currency: offer.priceCurrency || "COP",
          link: product.url || item.url,
          seller: "",
          isInternational: false,
          isLocal: true
        });
      }
    } catch (_) {
      // Ignore malformed JSON-LD blocks.
    }
  }

  const loosePattern = /"title"\s*:\s*"([^"]+)".{0,500}?"price"\s*:\s*([0-9.]+).{0,500}?"permalink"\s*:\s*"([^"]+)"/g;
  for (const match of html.matchAll(loosePattern)) {
    offers.push({
      title: decodeJsonText(match[1]),
      price: Number(match[2]),
      currency: "COP",
      link: decodeJsonText(match[3]),
      seller: "",
      isInternational: false,
      isLocal: true
    });
  }

  return offers;
}

function selectOffer(offers) {
  return offers
    .filter((offer) => {
      if (!offer || !offer.title || !Number.isFinite(offer.price) || offer.price <= 0) return false;
      if (offer.currency && offer.currency !== "COP") return false;
      if (offer.isInternational) return false;
      if (offer.isLocal === false) return false;
      return true;
    })
    .sort((a, b) => a.price - b.price)[0] || null;
}

function summarizeShipping(shipping) {
  if (!shipping || typeof shipping !== "object") return {};
  return {
    mode: shipping.mode || "",
    logisticType: shipping.logistic_type || "",
    freeShipping: Boolean(shipping.free_shipping),
    tags: Array.isArray(shipping.tags) ? shipping.tags : []
  };
}

function isLocalMeliItem(item) {
  const countryId = item?.seller_address?.country?.id || item?.address?.country_id || "";
  const countryName = item?.seller_address?.country?.name || "";
  if (!countryId && !countryName) return true;
  return countryId === "CO" || /colombia/i.test(countryName);
}

function isInternationalMeliItem(item) {
  const tags = [
    ...(Array.isArray(item?.tags) ? item.tags : []),
    ...(Array.isArray(item?.shipping?.tags) ? item.shipping.tags : [])
  ].join(" ");
  const logisticFields = [
    item?.shipping?.mode,
    item?.shipping?.logistic_type,
    item?.international_delivery_mode,
    item?.seller_address?.country?.id,
    item?.seller_address?.country?.name,
    item?.address?.country_id
  ].filter(Boolean).join(" ");

  if (!isLocalMeliItem(item)) return true;
  return /\b(international|global|cbt|cross_border|crossborder|import)\b/i.test(`${tags} ${logisticFields}`);
}

async function writeReportFiles(report) {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const basePath = path.join(REPORTS_DIR, report.id);
  const jsonPath = `${basePath}.json`;
  const csvPath = `${basePath}.csv`;
  const htmlPath = `${basePath}.html`;

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(csvPath, renderCsv(report), "utf8");
  await fs.writeFile(htmlPath, renderReportHtml(report), "utf8");

  return { json: jsonPath, csv: csvPath, html: htmlPath };
}

function renderCsv(report) {
  const rows = [
    ["Codigo", "Material", "Cantidad", "Unidad", "Precio unitario COP", "Subtotal COP", "Fuente", "Link", "Busqueda", "Notas"],
    ...report.materials.map((item) => [
      item.code,
      item.name,
      item.quantity,
      item.unit,
      item.unitPrice,
      item.subtotal,
      item.source,
      item.selectedOffer?.link || "",
      item.searchUrl,
      item.notes
    ])
  ];

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function renderReportHtml(report) {
  const rows = report.materials.map((item) => `
      <tr>
        <td>${escapeHtml(item.code)}</td>
        <td>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.notes || "")}</span>
        </td>
        <td>${item.quantity} ${escapeHtml(item.unit)}</td>
        <td>${money(item.unitPrice)}</td>
        <td>${money(item.subtotal)}</td>
        <td>${escapeHtml(item.source)}</td>
        <td>${renderMaterialLinks(item)}</td>
      </tr>`).join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Reporte de costos ${escapeHtml(report.id)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #24130f; background: #fbf9f6; }
    h1, h2 { margin: 0 0 12px; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 18px 0 28px; }
    .box { border: 1px solid #decfc5; background: #fff; border-radius: 8px; padding: 14px; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #decfc5; }
    th, td { padding: 10px; border-bottom: 1px solid #eee3dc; text-align: left; vertical-align: top; }
    th { background: #351c15; color: #fff; }
    td span { display: block; color: #6e584f; font-size: 12px; margin-top: 4px; }
    .total { font-size: 22px; font-weight: 700; color: #b73225; }
    a { color: #b73225; font-weight: 700; }
  </style>
</head>
<body>
  <h1>Ctrl + Rock - Reporte interno de costos</h1>
  <p>Reporte: <strong>${escapeHtml(report.id)}</strong> | Generado: ${escapeHtml(report.generatedAt)}</p>
  <div class="meta">
    <div class="box">
      <h2>Cliente</h2>
      <p>${escapeHtml(report.customer.name || "Sin nombre")}<br>${escapeHtml(report.customer.email || "")}<br>${escapeHtml(report.customer.phone || "")}</p>
    </div>
    <div class="box">
      <h2>Guitarra</h2>
      <p>${escapeHtml(report.guitar.description || report.guitar.model)}</p>
    </div>
    <div class="box">
      <h2>Total materiales</h2>
      <p class="total">${money(report.totalMaterialsCost)}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Codigo</th>
        <th>Material</th>
        <th>Cantidad</th>
        <th>Unitario</th>
        <th>Subtotal</th>
        <th>Fuente</th>
        <th>Links</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function renderCustomerEmailHtml(config, report) {
  const { customer, guitar } = config;
  return `<!doctype html>
<html lang="es">
<body style="font-family: Arial, sans-serif; color: #24130f; line-height: 1.5; margin: 0; padding: 24px; background: #fbf9f6;">
  <div style="max-width: 680px; margin: 0 auto; background: #fff; border: 1px solid #decfc5; border-radius: 8px; padding: 24px;">
    <h1 style="margin: 0 0 10px; color: #351c15;">Bienvenido a Ctrl + Rock</h1>
    <p>Hola ${escapeHtml(customer.name || "rockstar")}, gracias por cotizar tu guitarra custom con nosotros.</p>
    <p>Adjuntamos el PDF con el resumen tecnico de tu seleccion y una imagen de referencia del modelo completo.</p>
    <h2 style="font-size: 18px; margin-top: 24px; color: #b73225;">Resumen de tu guitarra</h2>
    <ul>
      <li><strong>Modelo:</strong> ${escapeHtml(guitar.model)}</li>
      <li><strong>Modo:</strong> ${escapeHtml(guitar.mode)}</li>
      <li><strong>Descripcion:</strong> ${escapeHtml(guitar.description || guitar.model)}</li>
      <li><strong>Costo estimado de materiales:</strong> ${money(report.totalMaterialsCost)}</li>
    </ul>
    <p>Esta cotizacion es una referencia inicial. El valor final puede ajustarse cuando el equipo de modelacion entregue el modelo de Inventor y se validen medidas, disponibilidad y acabados.</p>
    <p style="margin-bottom: 0;">Equipo Ctrl + Rock</p>
  </div>
</body>
</html>`;
}

function renderCustomerEmailText(config, report) {
  const { customer, guitar } = config;
  return [
    `Hola ${customer.name || "rockstar"}, gracias por cotizar tu guitarra custom con Ctrl + Rock.`,
    "",
    "Adjuntamos el PDF con el resumen tecnico de tu seleccion y una imagen de referencia del modelo completo.",
    "",
    `Modelo: ${guitar.model}`,
    `Modo: ${guitar.mode}`,
    `Descripcion: ${guitar.description || guitar.model}`,
    `Costo estimado de materiales: ${money(report.totalMaterialsCost)}`,
    "",
    "Esta cotizacion es una referencia inicial. El valor final puede ajustarse cuando se valide el modelo de Inventor.",
    "",
    "Equipo Ctrl + Rock"
  ].join("\n");
}

function renderMaterialLinks(item) {
  const links = [];

  if (item.selectedOffer?.link) {
    links.push(`<a href="${escapeHtml(item.selectedOffer.link)}" target="_blank" rel="noreferrer">Oferta encontrada</a>`);
  }

  if (item.searchUrl) {
    links.push(`<a href="${escapeHtml(item.searchUrl)}" target="_blank" rel="noreferrer">Busqueda MercadoLibre</a>`);
  }

  if (!links.length) return "Sin link";
  return links.join("<br>");
}

async function sendSmtpMail({ from, to, subject, text, html, attachments }) {
  const envelopeFrom = extractEmailAddress(from);
  const envelopeTo = extractEmailAddress(to);
  const socket = await createSmtpSocket();
  let client = createSmtpClient(socket);

  await client.read();
  let ehlo = await client.command(`EHLO ${getSmtpClientName()}`);

  if (!SMTP_SECURE && hasStartTls(ehlo)) {
    await client.command("STARTTLS");
    const secureSocket = tls.connect({
      socket: client.socket,
      servername: SMTP_HOST
    });
    await onceSecureConnect(secureSocket);
    client = createSmtpClient(secureSocket);
    ehlo = await client.command(`EHLO ${getSmtpClientName()}`);
  }

  if (SMTP_USER || SMTP_PASS) {
    const token = Buffer.from(`\0${SMTP_USER}\0${SMTP_PASS}`, "utf8").toString("base64");
    await client.command(`AUTH PLAIN ${token}`);
  }

  await client.command(`MAIL FROM:<${envelopeFrom}>`);
  await client.command(`RCPT TO:<${envelopeTo}>`);
  await client.command("DATA");
  await client.writeData(buildMimeMessage({ from, to, subject, text, html, attachments }));
  await client.command("QUIT", [221]);
}

function createSmtpSocket() {
  return new Promise((resolve, reject) => {
    const options = { host: SMTP_HOST, port: SMTP_PORT };
    const socket = SMTP_SECURE ? tls.connect(options) : net.connect(options);
    socket.setTimeout(30000);
    socket.once(SMTP_SECURE ? "secureConnect" : "connect", () => resolve(socket));
    socket.once("error", reject);
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("SMTP connection timed out"));
    });
  });
}

function createSmtpClient(socket) {
  let buffer = "";
  const pending = [];

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    flush();
  });

  socket.on("error", (error) => {
    while (pending.length) pending.shift().reject(error);
  });

  function flush() {
    const complete = buffer.match(/(?:^|\r?\n)(\d{3}) [^\r\n]*(?:\r?\n|$)/);
    if (!complete || !pending.length) return;
    const response = buffer.slice(0, complete.index + complete[0].length);
    buffer = buffer.slice(complete.index + complete[0].length);
    pending.shift().resolve(response);
  }

  function read(expectedCodes = [220, 221, 235, 250, 251, 354]) {
    return new Promise((resolve, reject) => {
      pending.push({
        resolve: (response) => {
          const code = Number(response.slice(0, 3));
          if (!expectedCodes.includes(code)) {
            reject(new Error(`SMTP ${code}: ${response.trim()}`));
          } else {
            resolve(response);
          }
        },
        reject
      });
      flush();
    });
  }

  return {
    socket,
    read,
    command(command, expectedCodes) {
      socket.write(`${command}\r\n`);
      return read(expectedCodes);
    },
    async writeData(message) {
      socket.write(`${escapeSmtpData(message)}\r\n.\r\n`);
      return read([250]);
    }
  };
}

function onceSecureConnect(socket) {
  return new Promise((resolve, reject) => {
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  });
}

function buildMimeMessage({ from, to, subject, text, html, attachments }) {
  const boundary = `ctrl-rock-${crypto.randomBytes(12).toString("hex")}`;
  const parts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(12).toString("hex")}@ctrl-rock.local>`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(text, "utf8").toString("base64")),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(html, "utf8").toString("base64"))
  ];

  for (const attachment of attachments || []) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${attachment.contentType}; name="${attachment.filename}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      "",
      wrapBase64(attachment.content.toString("base64"))
    );
  }

  parts.push(`--${boundary}--`, "");
  return parts.join("\r\n");
}

async function writeSentQuoteReceipt(receipt) {
  await fs.mkdir(SENT_QUOTES_DIR, { recursive: true });
  await fs.writeFile(path.join(SENT_QUOTES_DIR, `${receipt.id}.json`), JSON.stringify(receipt, null, 2), "utf8");
}

function hasSmtpConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_FROM);
}

function hasStartTls(response) {
  return /\bSTARTTLS\b/i.test(response);
}

function getSmtpClientName() {
  return process.env.SMTP_CLIENT_NAME || "ctrl-rock.local";
}

function encodeMimeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(String(value), "utf8").toString("base64")}?=`;
}

function wrapBase64(value) {
  return String(value).replace(/.{1,76}/g, "$&\r\n").trim();
}

function escapeSmtpData(message) {
  return String(message).replace(/^\./gm, "..");
}

function extractEmailAddress(value) {
  const text = String(value || "");
  const match = text.match(/<([^>]+)>/);
  return (match ? match[1] : text).trim();
}

async function listReports() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  const files = await fs.readdir(REPORTS_DIR);
  const jsonFiles = files.filter((file) => file.endsWith(".json")).sort().reverse();
  const reports = [];

  for (const file of jsonFiles) {
    try {
      const report = JSON.parse(await fs.readFile(path.join(REPORTS_DIR, file), "utf8"));
      reports.push({
        id: report.id,
        generatedAt: report.generatedAt,
        customer: report.customer?.name || "",
        email: report.customer?.email || "",
        model: report.guitar?.model || "",
        totalMaterialsCost: report.totalMaterialsCost,
        currency: report.currency
      });
    } catch (_) {
      // Ignore broken report files.
    }
  }

  return reports;
}

async function renderReportIndex(requestUrl) {
  const reports = await listReports();
  const token = requestUrl.searchParams.get("token") || "";
  const rows = reports.map((report) => `
    <tr>
      <td><a href="/admin/reports/${report.id}?token=${encodeURIComponent(token)}">${escapeHtml(report.id)}</a></td>
      <td>${escapeHtml(report.generatedAt)}</td>
      <td>${escapeHtml(report.customer)}</td>
      <td>${escapeHtml(report.email)}</td>
      <td>${escapeHtml(report.model)}</td>
      <td>${money(report.totalMaterialsCost)}</td>
    </tr>`).join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Reportes internos Ctrl + Rock</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #24130f; background: #fbf9f6; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { padding: 10px; border-bottom: 1px solid #eee3dc; text-align: left; }
    th { background: #351c15; color: #fff; }
    a { color: #b73225; font-weight: 700; }
  </style>
</head>
<body>
  <h1>Reportes internos Ctrl + Rock</h1>
  <table>
    <thead><tr><th>Reporte</th><th>Fecha</th><th>Cliente</th><th>Email</th><th>Modelo</th><th>Total materiales</th></tr></thead>
    <tbody>${rows || "<tr><td colspan=\"6\">No hay reportes todavia.</td></tr>"}</tbody>
  </table>
</body>
</html>`;
}

async function servePrivateReport(res, reportId) {
  const cleanId = reportId.replace(/[^a-zA-Z0-9_-]/g, "");
  const jsonPath = path.join(REPORTS_DIR, `${cleanId}.json`);
  const htmlPath = path.join(REPORTS_DIR, `${cleanId}.html`);

  try {
    const report = JSON.parse(await fs.readFile(jsonPath, "utf8"));
    return sendHtml(res, 200, renderReportHtml(report));
  } catch (_) {
    // Fall back to the static HTML if a legacy JSON file is missing or broken.
  }

  try {
    const html = await fs.readFile(htmlPath, "utf8");
    return sendHtml(res, 200, html);
  } catch (_) {
    return sendHtml(res, 404, "<h1>Reporte no encontrado</h1>");
  }
}

async function serveStaticFrontend(req, res, requestUrl) {
  if (req.method !== "GET") return sendJson(res, 404, { ok: false, error: "Not found" });

  let pathname = decodeURIComponent(requestUrl.pathname);
  if (pathname === "/") pathname = "/index.html";
  pathname = pathname.replace(/^\/Frontend\//, "/");

  const requestedPath = path.normalize(path.join(FRONTEND_DIR, pathname));
  if (!requestedPath.startsWith(FRONTEND_DIR)) {
    return send(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
  }

  try {
    const file = await fs.readFile(requestedPath);
    const ext = path.extname(requestedPath).toLowerCase();
    return send(res, 200, file, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
  } catch (_) {
    return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  }
}

function isWorkerAuthorized(req, requestUrl) {
  const token = requestUrl.searchParams.get("token") || req.headers["x-worker-token"] || "";
  return token && token === ADMIN_TOKEN;
}

function buildMeliSearchUrl(query) {
  const slug = encodeURIComponent(query.trim().replace(/\s+/g, "-"));
  return `https://listado.mercadolibre.com.co/${slug}`;
}

function makeReportId() {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `cost-${stamp}-${crypto.randomBytes(3).toString("hex")}`;
}

function makeQuoteId() {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `quote-${stamp}-${crypto.randomBytes(3).toString("hex")}`;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function cleanBase64(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const base64 = text.includes(",") ? text.slice(text.indexOf(",") + 1) : text;
  return /^[A-Za-z0-9+/=\s]+$/.test(base64) ? base64.replace(/\s+/g, "") : "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function toNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function capitalize(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

function money(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function unescapeHtml(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function decodeJsonText(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch (_) {
    return value;
  }
}

function sendJson(res, statusCode, body) {
  return send(res, statusCode, JSON.stringify(body), JSON_HEADERS);
}

function sendHtml(res, statusCode, body) {
  return send(res, statusCode, body, { "Content-Type": "text/html; charset=utf-8" });
}

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      const error = new Error("Payload too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  try {
    return JSON.parse(raw);
  } catch (_) {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

function loadDotEnv(filePath) {
  try {
    const content = require("fs").readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (_) {
    // .env is optional.
  }
}

main();
