const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const DATA_FILE = path.join(__dirname, "..", "data", "store.json");

function createSeedState() {
  const now = Date.now();
  const baseProducts = [
    ["Premium Notebook", "STK-101", "Stationery", "Campus Paper Co.", 299, 34, 10],
    ["Wireless Mouse", "ELE-220", "Electronics", "Pixel Devices", 799, 7, 8],
    ["Ceramic Coffee Mug", "HOM-045", "Home Goods", "Daily Living", 249, 18, 6],
    ["Desk Study Lamp", "LGT-310", "Lighting", "BrightNest", 1299, 12, 4],
    ["Steel Water Bottle", "LIF-125", "Lifestyle", "Urban Carry", 499, 29, 9],
    ["Portable Bluetooth Speaker", "ELE-415", "Electronics", "SoundMint", 1899, 5, 6],
    ["Document File Folder", "STK-145", "Stationery", "Campus Paper Co.", 149, 42, 12],
    ["Mini Desk Planter", "DEC-212", "Decor", "LeafLine Studio", 349, 9, 5],
    ["Wireless Keyboard", "ELE-305", "Electronics", "Pixel Devices", 1499, 14, 5],
    ["Whiteboard Marker Pack", "STK-188", "Stationery", "WriteRight Supply", 219, 48, 15],
  ];

  const catalogTemplates = [
    ["A4 Spiral Notebook", "Stationery", "Campus Paper Co.", 179, 52, 14],
    ["Gel Pen Set", "Stationery", "WriteRight Supply", 129, 63, 18],
    ["Sticky Notes Pad", "Stationery", "WriteRight Supply", 89, 57, 16],
    ["Sketch Book", "Stationery", "Campus Paper Co.", 199, 28, 8],
    ["Ring Binder", "Stationery", "Campus Paper Co.", 169, 31, 10],
    ["USB Flash Drive 64GB", "Electronics", "ByteKart", 649, 19, 6],
    ["Wireless Earbuds", "Electronics", "SoundMint", 2199, 11, 5],
    ["Laptop Stand", "Electronics", "Pixel Devices", 999, 16, 6],
    ["HD Webcam", "Electronics", "VisionCore", 1599, 8, 4],
    ["Phone Charging Cable", "Electronics", "ByteKart", 299, 37, 12],
    ["Ceramic Vase", "Home Goods", "Daily Living", 599, 17, 5],
    ["Cotton Cushion Cover", "Home Goods", "Daily Living", 349, 23, 7],
    ["Storage Basket", "Home Goods", "Daily Living", 449, 14, 5],
    ["Wall Clock", "Home Goods", "Daily Living", 899, 10, 4],
    ["Cutlery Organizer", "Home Goods", "Daily Living", 399, 21, 7],
    ["LED Night Lamp", "Lighting", "BrightNest", 699, 20, 6],
    ["Table Lantern", "Lighting", "BrightNest", 1099, 9, 4],
    ["Decor String Lights", "Lighting", "BrightNest", 549, 25, 8],
    ["Desk Accent Light", "Lighting", "BrightNest", 899, 13, 4],
    ["Rechargeable Torch", "Lighting", "BrightNest", 749, 18, 6],
    ["Yoga Bottle", "Lifestyle", "Urban Carry", 429, 24, 8],
    ["Canvas Tote Bag", "Lifestyle", "Urban Carry", 599, 15, 5],
    ["Travel Pouch", "Lifestyle", "Urban Carry", 379, 26, 8],
    ["Desk Calendar", "Lifestyle", "Urban Carry", 219, 32, 11],
    ["Minimal Wrist Journal", "Lifestyle", "Urban Carry", 329, 20, 7],
    ["Photo Frame", "Decor", "LeafLine Studio", 459, 18, 6],
    ["Scented Candle", "Decor", "LeafLine Studio", 349, 27, 9],
    ["Wall Shelf Accent", "Decor", "LeafLine Studio", 799, 7, 4],
    ["Marble Coaster Set", "Decor", "LeafLine Studio", 529, 12, 4],
    ["Mini Art Print", "Decor", "LeafLine Studio", 299, 30, 10],
  ];

  const generatedProducts = catalogTemplates.flatMap((template, templateIndex) => {
    return [1, 2].map((variant) => {
      const [name, category, supplier, price, quantity, threshold] = template;
      const id = randomUUID();
      const skuPrefix = category.slice(0, 3).toUpperCase();
      return {
        id,
        name: `${name} ${variant === 1 ? "Standard" : "Plus"}`,
        sku: `${skuPrefix}-${templateIndex + 1}${variant}`,
        category,
        supplier,
        price: price + (variant - 1) * 80,
        quantity: Math.max(4, quantity - variant * 2 + (templateIndex % 5)),
        threshold: Math.max(4, threshold),
        updatedAt: new Date(now - (templateIndex + variant) * 3600000).toISOString(),
      };
    });
  });

  const products = [...baseProducts.map(([name, sku, category, supplier, price, quantity, threshold]) => ({
    id: randomUUID(),
    name,
    sku,
    category,
    supplier,
    price,
    quantity,
    threshold,
    updatedAt: new Date().toISOString(),
  })), ...generatedProducts];

  const productByName = new Map(products.map((product) => [product.name, product]));
  const movementSeed = [
    ["Premium Notebook", "out", 2, "Front counter order for college students", 0.5],
    ["Ceramic Coffee Mug", "in", 5, "Supplier restock received in the morning", 4],
    ["Portable Bluetooth Speaker", "out", 3, "Weekend promotion bundle dispatch", 8],
    ["Whiteboard Marker Pack", "in", 18, "Bulk stationery refill for workspace demand", 26],
    ["Wireless Mouse", "out", 2, "Office setup order for startup client", 32],
    ["Steel Water Bottle", "in", 12, "New shipment added to warehouse", 40],
    ["Document File Folder", "out", 10, "Institutional stationery order packed", 52],
    ["Mini Desk Planter", "out", 4, "Lifestyle shelf sale", 68],
    ["Desk Study Lamp", "in", 6, "Premium lighting stock intake", 76],
    ["A4 Spiral Notebook Standard", "out", 11, "Semester opening stationery rush", 82],
    ["Gel Pen Set Plus", "out", 7, "Back-to-office desk refill purchase", 90],
    ["USB Flash Drive 64GB Standard", "in", 9, "Electronics restock batch arrival", 98],
    ["Wireless Earbuds Plus", "out", 4, "Gift bundle checkout", 106],
    ["Photo Frame Standard", "out", 6, "Home styling display sale", 118],
    ["LED Night Lamp Plus", "in", 8, "Lighting collection refresh", 126],
    ["Canvas Tote Bag Standard", "out", 5, "Lifestyle weekend campaign order", 134],
    ["Storage Basket Plus", "in", 7, "Warehouse replenishment cycle", 144],
    ["Scented Candle Standard", "out", 9, "Decor aisle festive sale", 156],
  ];

  const movements = movementSeed
    .map(([name, type, quantity, note, hoursAgo]) => {
      const product = productByName.get(name);
      if (!product) {
        return null;
      }

      return {
        id: randomUUID(),
        type,
        productId: product.id,
        productName: product.name,
        quantity,
        note,
        amount: product.price * quantity,
        createdAt: new Date(now - hoursAgo * 60 * 60 * 1000).toISOString(),
      };
    })
    .filter(Boolean);

  return {
    products,
    movements,
    shares: [
      {
        id: randomUUID(),
        name: "Store Manager",
        email: "manager@stockpilot.demo",
        role: "Editor",
        token: "INV-" + randomUUID().slice(0, 8).toUpperCase(),
        status: "Active",
        createdAt: new Date().toISOString(),
      },
      {
        id: randomUUID(),
        name: "Warehouse Lead",
        email: "warehouse@stockpilot.demo",
        role: "Editor",
        token: "INV-" + randomUUID().slice(0, 8).toUpperCase(),
        status: "Active",
        createdAt: new Date(now - 18 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: randomUUID(),
        name: "Accounts Reviewer",
        email: "accounts@stockpilot.demo",
        role: "Viewer",
        token: "INV-" + randomUUID().slice(0, 8).toUpperCase(),
        status: "Active",
        createdAt: new Date(now - 42 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };
}

let memoryStore = createSeedState();

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await writeFileStore(createSeedState());
  }
}

async function readFileStore() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return normalizeStore(JSON.parse(raw));
}

async function writeFileStore(data) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(normalizeStore(data), null, 2), "utf8");
}

function cloneStore(data) {
  return JSON.parse(JSON.stringify(data));
}

function getStoreMode() {
  return process.env.VERCEL ? "memory" : "file";
}

function normalizeStore(data) {
  return {
    products: Array.isArray(data.products)
      ? data.products.map((product, index) => ({
          id: product.id || randomUUID(),
          name: product.name || `Inventory Item ${index + 1}`,
          sku: product.sku || `SKU-${String(index + 1).padStart(3, "0")}`,
          category: product.category || "General",
          supplier: product.supplier || "Internal Supplier",
          price: Number(product.price) || 0,
          quantity: Number(product.quantity) || 0,
          threshold: Number(product.threshold) || 5,
          updatedAt: product.updatedAt || new Date().toISOString(),
        }))
      : [],
    movements: Array.isArray(data.movements)
      ? data.movements
      : Array.isArray(data.sales)
        ? data.sales.map((sale) => ({
            id: sale.id,
            type: "out",
            productId: sale.productId,
            productName: sale.productName,
            quantity: sale.quantity,
            note: sale.customer || "Recorded sale",
            amount: sale.amount,
            createdAt: sale.createdAt,
          }))
        : [],
    shares: Array.isArray(data.shares) ? data.shares : [],
  };
}

async function readStore() {
  if (getStoreMode() === "memory") {
    return cloneStore(normalizeStore(memoryStore));
  }

  return readFileStore();
}

async function writeStore(data) {
  const next = normalizeStore(data);

  if (getStoreMode() === "memory") {
    memoryStore = cloneStore(next);
    return;
  }

  await writeFileStore(next);
}

async function resetStore() {
  const nextState = createSeedState();
  await writeStore(nextState);
  return nextState;
}

function createInviteToken() {
  return "INV-" + randomUUID().slice(0, 8).toUpperCase();
}

module.exports = {
  createSeedState,
  readStore,
  writeStore,
  resetStore,
  createInviteToken,
  randomUUID,
};
