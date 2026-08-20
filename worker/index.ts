/** Cloudflare Worker entry point for the vinext-starter template. */
import {
  handleImageOptimization,
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { createDocumentPdfDataUri } from "../app/document-pdf";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: R2Bucket;
  EMAIL_ENCRYPTION_KEY?: string;
  PUBLIC_APP_ORIGIN?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type DirectoryCustomerRow = {
  id: number;
  customer_number: string;
  name: string;
  contact_salutation: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  markup_percent: number;
  status: string;
};
type DirectoryEmployeeRow = {
  id: number;
  customer_id: number;
  name: string;
  salutation: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  login: string;
  password_hash: string;
  mail_to_main: number;
};
type DirectorySupplierRow = {
  id: number;
  supplier_number: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  group_name: string | null;
};
type StateEmployee = {
  id: number;
  name: string;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  login: string;
  password?: string;
  mailToMain: boolean;
};
type StateCustomer = {
  id: number;
  number: string;
  name: string;
  contactSalutation?: string;
  contactFirstName?: string;
  contactLastName?: string;
  email: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  markup: number;
  status: string;
  turnover: number;
  employees: StateEmployee[];
};
type StateSupplier = {
  id: number;
  number: string;
  name: string;
  group: string;
  contact: string;
  email: string;
  phone: string;
};
type StateArticle = {
  id: number;
  sku: string;
  designation1: string;
  designation2: string;
  name: string;
  customerId?: number;
  supplier: string;
  stock: number;
  minimum: number;
  unitPrice: number;
  stockHistory: Array<{
    date: string;
    change: number;
    stock: number;
    reason: string;
  }>;
  templates: Array<{ id: number; file: string; addedAt: string; url?: string }>;
};
type StateDocumentItem = {
  articleId: number;
  sku: string;
  article: string;
  quantity: number;
  requestedQuantities?: number[];
  unitPrice: number;
  subtotal: number;
  markupAmount: number;
  total: number;
  printFile?: string;
  printFileUrl?: string;
  supplierGzd?: string;
  supplierGzdUrl?: string;
  gzdStatus?: string;
  offerOptions?: Array<{
    quantity: number;
    unitPrice: number;
    supplierTotal?: number;
  }>;
};
type StateDocument = {
  id: number;
  number: string;
  type: string;
  customerId: number;
  customer: string;
  employeeId?: number;
  employee: string;
  supplier?: string;
  supplierId?: number;
  supplierToken?: string;
  projectId?: number;
  articleId?: number;
  article: string;
  quantity: number;
  requestedQuantities?: number[];
  unitPrice: number;
  subtotal: number;
  markupPercent: number;
  markupAmount: number;
  total: number;
  date: string;
  createdAt?: string;
  deliveryDate?: string;
  supplierLeadTime?: string;
  supplierDeliveryDate?: string;
  supplierDeliveryNote?: string;
  supplierReference?: string;
  bindingDeliveryConfirmationDue?: string;
  note?: string;
  requestText?: string;
  documentText?: string;
  attachDocument?: boolean;
  attachGzd?: boolean;
  printFile?: string;
  printFileUrl?: string;
  supplierGzd?: string;
  supplierGzdUrl?: string;
  supplierNote?: string;
  gzdStatus?: string;
  offerOptions?: Array<{
    quantity: number;
    unitPrice: number;
    supplierTotal?: number;
  }>;
  items?: StateDocumentItem[];
  status: string;
};
type StateBackendUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  password: string;
  active: boolean;
};
type StateWorkflow = {
  requestTemplate: string;
  offerTemplate: string;
  orderTemplate: string;
  confirmationTemplate: string;
  reorderPointSubject: string;
  reorderPointTemplate: string;
  requestRecipient: "customer" | "supplier" | "system";
  offerRecipient: "customer" | "supplier" | "system";
  orderRecipient: "customer" | "supplier" | "system";
  confirmationRecipient: "customer" | "supplier" | "system";
  reorderPointRecipient: "customer" | "supplier" | "system";
  employeeLoginSubject: string;
  employeeLoginTemplate: string;
  customerPasswordResetSubject: string;
  customerPasswordResetTemplate: string;
  backendPasswordResetSubject: string;
  backendPasswordResetTemplate: string;
  supplierOfferSubject: string;
  offerEmail: string;
  orderEmail: string;
  attachRequestDocument: boolean;
  attachRequestGzd: boolean;
  attachOfferDocument: boolean;
  attachOfferGzd: boolean;
  attachOrderDocument: boolean;
  attachOrderGzd: boolean;
  attachConfirmationDocument: boolean;
  attachConfirmationGzd: boolean;
};
type FullState = {
  customers: StateCustomer[];
  suppliers: StateSupplier[];
  groups: string[];
  articles: StateArticle[];
  documents: StateDocument[];
  backendUsers: StateBackendUser[];
  workflowSettings: StateWorkflow;
};

const json = (data: unknown, init?: ResponseInit) =>
  Response.json(data, { headers: { "Cache-Control": "no-store" }, ...init });

function publicAppOrigin(env: Env, url: URL) {
  try {
    const configured = new URL(env.PUBLIC_APP_ORIGIN || url.origin);
    if (configured.protocol === "http:" || configured.protocol === "https:")
      return configured.origin;
  } catch {
    // Eine ungültige Konfiguration fällt sicher auf den Worker-Ursprung zurück.
  }
  return url.origin;
}

function requestOrigins(request: Request, url: URL, env: Env) {
  const origins = new Set([url.origin]);
  origins.add(publicAppOrigin(env, url));
  const forwardedHost = request.headers
    .get("X-Forwarded-Host")
    ?.split(",")[0]
    .trim();
  const forwardedProto = request.headers
    .get("X-Forwarded-Proto")
    ?.split(",")[0]
    .trim()
    .toLowerCase();
  if (
    forwardedHost &&
    /^(?:https?)$/.test(forwardedProto || "") &&
    /^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::\d{1,5})?$/i.test(
      forwardedHost,
    )
  )
    origins.add(`${forwardedProto}://${forwardedHost}`);
  return origins;
}

const sameOriginRequest = (request: Request, url: URL, env: Env) => {
  const origin = request.headers.get("Origin");
  return !origin || requestOrigins(request, url, env).has(origin);
};

async function ensureDirectorySchema(db: D1Database) {
  await db.batch([
    db.prepare(
      "CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_number TEXT NOT NULL UNIQUE, name TEXT NOT NULL, contact_name TEXT, contact_salutation TEXT, contact_first_name TEXT, contact_last_name TEXT, email TEXT, phone TEXT, street TEXT, postal_code TEXT, city TEXT, country TEXT NOT NULL DEFAULT 'Schweiz', markup_percent REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS customer_employees (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id), name TEXT NOT NULL, salutation TEXT, first_name TEXT, last_name TEXT, email TEXT NOT NULL UNIQUE, phone TEXT, login TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, mail_to_main INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS supplier_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS suppliers (id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_number TEXT NOT NULL UNIQUE, name TEXT NOT NULL, contact_name TEXT, email TEXT, phone TEXT, group_id INTEGER REFERENCES supplier_groups(id) ON DELETE SET NULL)",
    ),
  ]);
  await ensureColumn(db, "customers", "contact_salutation", "TEXT");
  await ensureColumn(db, "customers", "contact_first_name", "TEXT");
  await ensureColumn(db, "customers", "contact_last_name", "TEXT");
  await ensureColumn(db, "customer_employees", "salutation", "TEXT");
  await ensureColumn(db, "customer_employees", "first_name", "TEXT");
  await ensureColumn(db, "customer_employees", "last_name", "TEXT");
  const marker = await db
    .prepare("SELECT value FROM app_meta WHERE key = ?")
    .bind("directory_seeded")
    .first<{ value: string }>();
  if (marker) return;
  const counts = await db
    .prepare(
      "SELECT (SELECT COUNT(*) FROM customers) + (SELECT COUNT(*) FROM suppliers) AS total",
    )
    .first<{ total: number }>();
  if (!counts?.total) {
    await db.batch([
      db
        .prepare(
          "INSERT OR IGNORE INTO supplier_groups (id, name) VALUES (?, ?)",
        )
        .bind(1, "Papier"),
      db
        .prepare(
          "INSERT OR IGNORE INTO supplier_groups (id, name) VALUES (?, ?)",
        )
        .bind(2, "Veredelung"),
      db
        .prepare(
          "INSERT OR IGNORE INTO supplier_groups (id, name) VALUES (?, ?)",
        )
        .bind(3, "Weiterverarbeitung"),
      db
        .prepare(
          "INSERT OR IGNORE INTO customers (id, customer_number, name, email, phone, street, postal_code, city, country, markup_percent, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          1,
          "K-10024",
          "Studio Nord GmbH",
          "hello@studionord.ch",
          "+41 44 211 08 60",
          "Nordstrasse 24",
          "8006",
          "Zürich",
          "Schweiz",
          12,
          "active",
        ),
      db
        .prepare(
          "INSERT OR IGNORE INTO customers (id, customer_number, name, email, phone, street, postal_code, city, country, markup_percent, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          2,
          "K-10031",
          "Café Cobalt",
          "hallo@cafecobalt.ch",
          "+41 44 330 41 10",
          "Cobaltweg 8",
          "8005",
          "Zürich",
          "Schweiz",
          18,
          "active",
        ),
      db
        .prepare(
          "INSERT OR IGNORE INTO customers (id, customer_number, name, email, phone, street, postal_code, city, country, markup_percent, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          3,
          "K-10037",
          "Atelier Riedel",
          "mail@atelier-riedel.ch",
          "+41 61 690 18 08",
          "Werkhofstrasse 17",
          "4058",
          "Basel",
          "Schweiz",
          10,
          "active",
        ),
      db
        .prepare(
          "INSERT OR IGNORE INTO customer_employees (id, customer_id, name, email, phone, login, password_hash, mail_to_main) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          11,
          1,
          "Mara Vogt",
          "mara.vogt@studionord.ch",
          "+41 79 610 22 14",
          "mara.vogt@studionord.ch",
          "portal",
          1,
        ),
      db
        .prepare(
          "INSERT OR IGNORE INTO customer_employees (id, customer_id, name, email, phone, login, password_hash, mail_to_main) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          12,
          1,
          "Jonas Lenz",
          "jonas.lenz@studionord.ch",
          "+41 79 820 09 11",
          "jonas.lenz@studionord.ch",
          "portal",
          0,
        ),
      db
        .prepare(
          "INSERT OR IGNORE INTO customer_employees (id, customer_id, name, email, phone, login, password_hash, mail_to_main) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          21,
          2,
          "Lina Ziegler",
          "lina@cafecobalt.ch",
          "+41 78 920 05 16",
          "lina@cafecobalt.ch",
          "portal",
          1,
        ),
      db
        .prepare(
          "INSERT OR IGNORE INTO customer_employees (id, customer_id, name, email, phone, login, password_hash, mail_to_main) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          22,
          2,
          "Noel Marti",
          "noel@cafecobalt.ch",
          "+41 76 880 14 70",
          "noel@cafecobalt.ch",
          "portal",
          0,
        ),
      db
        .prepare(
          "INSERT OR IGNORE INTO customer_employees (id, customer_id, name, email, phone, login, password_hash, mail_to_main) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          31,
          3,
          "Nils Riedel",
          "nils@atelier-riedel.ch",
          "+41 79 777 28 19",
          "nils@atelier-riedel.ch",
          "portal",
          1,
        ),
      db.prepare(
        "UPDATE customers SET contact_salutation = 'Frau', contact_first_name = 'Mara', contact_last_name = 'Vogt' WHERE id = 1",
      ),
      db.prepare(
        "UPDATE customers SET contact_salutation = 'Frau', contact_first_name = 'Lina', contact_last_name = 'Ziegler' WHERE id = 2",
      ),
      db.prepare(
        "UPDATE customers SET contact_salutation = 'Herr', contact_first_name = 'Nils', contact_last_name = 'Riedel' WHERE id = 3",
      ),
      db.prepare(
        "UPDATE customer_employees SET salutation = 'Frau', first_name = 'Mara', last_name = 'Vogt' WHERE id = 11",
      ),
      db.prepare(
        "UPDATE customer_employees SET salutation = 'Herr', first_name = 'Jonas', last_name = 'Lenz' WHERE id = 12",
      ),
      db.prepare(
        "UPDATE customer_employees SET salutation = 'Frau', first_name = 'Lina', last_name = 'Ziegler' WHERE id = 21",
      ),
      db.prepare(
        "UPDATE customer_employees SET salutation = 'Divers', first_name = 'Noel', last_name = 'Marti' WHERE id = 22",
      ),
      db.prepare(
        "UPDATE customer_employees SET salutation = 'Herr', first_name = 'Nils', last_name = 'Riedel' WHERE id = 31",
      ),
      db
        .prepare(
          "INSERT OR IGNORE INTO suppliers (id, supplier_number, name, contact_name, email, phone, group_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          1,
          "L-2011",
          "Papierwerk Süd",
          "Julia Keller",
          "jkeller@papierwerk-sued.de",
          "+49 761 441 63 10",
          1,
        ),
      db
        .prepare(
          "INSERT OR IGNORE INTO suppliers (id, supplier_number, name, contact_name, email, phone, group_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          2,
          "L-2034",
          "Farbwerk AG",
          "Andreas Haas",
          "a.haas@farbwerk.ch",
          "+41 71 811 24 81",
          2,
        ),
      db
        .prepare(
          "INSERT OR IGNORE INTO suppliers (id, supplier_number, name, contact_name, email, phone, group_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          3,
          "L-2052",
          "Die Buchbinderei",
          "Sarah Winter",
          "s.winter@buchbinderei.ch",
          "+41 44 770 15 00",
          3,
        ),
    ]);
  }
  await db
    .prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)")
    .bind("directory_seeded", "1")
    .run();
}

async function tableExists(db: D1Database, name: string) {
  return Boolean(
    await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .bind(name)
      .first(),
  );
}

async function ensureColumn(
  db: D1Database,
  table: string,
  column: string,
  definition: string,
) {
  if (
    !/^[a-z_][a-z0-9_]*$/.test(table) ||
    !/^[a-z_][a-z0-9_]*$/.test(column) ||
    !/^[A-Za-z0-9_ '[\]().*;,-]+$/.test(definition)
  )
    throw new Error("Invalid schema identifier");
  const columns = await db
    .prepare(`PRAGMA table_info(${table})`)
    .all<{ name: string }>();
  if (!columns.results.some((item) => item.name === column))
    await db
      .prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
      .run();
}

async function readDirectory(db: D1Database) {
  const [customerRows, employeeRows, supplierRows, groupRows] =
    await Promise.all([
      db
        .prepare(
          "SELECT id, customer_number, name, contact_salutation, contact_first_name, contact_last_name, email, phone, street, postal_code, city, country, markup_percent, status FROM customers ORDER BY name",
        )
        .all<DirectoryCustomerRow>(),
      db
        .prepare(
          "SELECT id, customer_id, name, salutation, first_name, last_name, email, phone, login, password_hash, mail_to_main FROM customer_employees WHERE active = 1 ORDER BY name",
        )
        .all<DirectoryEmployeeRow>(),
      db
        .prepare(
          "SELECT s.id, s.supplier_number, s.name, s.contact_name, s.email, s.phone, g.name AS group_name FROM suppliers s LEFT JOIN supplier_groups g ON g.id = s.group_id ORDER BY s.name",
        )
        .all<DirectorySupplierRow>(),
      db
        .prepare("SELECT name FROM supplier_groups ORDER BY name")
        .all<{ name: string }>(),
    ]);
  const employeesByCustomer = new Map<number, DirectoryEmployeeRow[]>();
  for (const employee of employeeRows.results)
    employeesByCustomer.set(employee.customer_id, [
      ...(employeesByCustomer.get(employee.customer_id) ?? []),
      employee,
    ]);
  return {
    customers: customerRows.results.map((customer) => ({
      id: customer.id,
      number: customer.customer_number,
      name: customer.name,
      contactSalutation: customer.contact_salutation ?? "Divers",
      contactFirstName: customer.contact_first_name ?? "",
      contactLastName: customer.contact_last_name ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      street: customer.street ?? "",
      postalCode: customer.postal_code ?? "",
      city: customer.city ?? "",
      country: customer.country,
      markup: customer.markup_percent,
      status: customer.status === "active" ? "Aktiv" : "Entwurf",
      turnover: 0,
      employees: (employeesByCustomer.get(customer.id) ?? []).map(
        (employee) => ({
          id: employee.id,
          name: employee.name,
          salutation: employee.salutation ?? "Divers",
          firstName: employee.first_name ?? employee.name.split(" ")[0] ?? "",
          lastName:
            employee.last_name ?? employee.name.split(" ").slice(1).join(" "),
          email: employee.email,
          phone: employee.phone ?? "",
          login: employee.login,
          password: employee.password_hash,
          mailToMain: Boolean(employee.mail_to_main),
        }),
      ),
    })),
    suppliers: supplierRows.results.map((supplier) => ({
      id: supplier.id,
      number: supplier.supplier_number,
      name: supplier.name,
      group: supplier.group_name ?? "Ohne Gruppe",
      contact: supplier.contact_name ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
    })),
    groups: groupRows.results.map((group) => group.name),
  };
}

async function nextNumber(db: D1Database, table: "customers" | "suppliers") {
  const column = table === "customers" ? "customer_number" : "supplier_number";
  const prefix = table === "customers" ? "K-" : "L-";
  const floor = table === "customers" ? 10038 : 2053;
  const row = await db
    .prepare(
      `SELECT MAX(CAST(SUBSTR(${column}, 3) AS INTEGER)) AS value FROM ${table}`,
    )
    .first<{ value: number | null }>();
  return `${prefix}${Math.max(floor - 1, row?.value ?? 0) + 1}`;
}

async function resolveGroupId(db: D1Database, name: string) {
  if (!name || name === "Ohne Gruppe") return null;
  await db
    .prepare("INSERT OR IGNORE INTO supplier_groups (name) VALUES (?)")
    .bind(name)
    .run();
  return (
    (
      await db
        .prepare("SELECT id FROM supplier_groups WHERE name = ?")
        .bind(name)
        .first<{ id: number }>()
    )?.id ?? null
  );
}

async function ensureFullSchema(db: D1Database) {
  await ensureDirectorySchema(db);
  await db.batch([
    db.prepare(
      "CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY AUTOINCREMENT, sku TEXT NOT NULL UNIQUE, designation_1 TEXT NOT NULL, designation_2 TEXT NOT NULL DEFAULT '', customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL, supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL, supplier_group_id INTEGER REFERENCES supplier_groups(id) ON DELETE SET NULL, stock INTEGER NOT NULL DEFAULT 0, reorder_point INTEGER NOT NULL DEFAULT 0, unit_price REAL NOT NULL DEFAULT 0, stock_history_json TEXT NOT NULL DEFAULT '[]', print_file_key TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS customer_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS gzd_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, file_name TEXT NOT NULL, object_key TEXT NOT NULL, uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS stock_events (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE, occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, change INTEGER NOT NULL, stock_after INTEGER NOT NULL, reason TEXT NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'requested', customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL, customer_employee_id INTEGER REFERENCES customer_employees(id) ON DELETE SET NULL, article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL, supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL, supplier_group_id INTEGER REFERENCES supplier_groups(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, document_number TEXT NOT NULL UNIQUE, type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL, customer_employee_id INTEGER REFERENCES customer_employees(id) ON DELETE SET NULL, supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL, subtotal REAL NOT NULL DEFAULT 0, markup_percent REAL NOT NULL DEFAULT 0, markup_amount REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0, issued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, supplier_token TEXT, delivery_date TEXT, supplier_lead_time TEXT, supplier_delivery_date TEXT, supplier_delivery_note TEXT, supplier_reference TEXT, binding_delivery_confirmation_due TEXT, requested_quantities_json TEXT NOT NULL DEFAULT '[]', note TEXT, request_text TEXT, document_text TEXT, supplier_note TEXT, attach_document INTEGER NOT NULL DEFAULT 1, attach_gzd INTEGER NOT NULL DEFAULT 1, print_file_key TEXT, supplier_gzd_key TEXT, gzd_status TEXT, pdf_object_key TEXT, payload TEXT NOT NULL DEFAULT '{}')",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS document_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL, title TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, line_total REAL NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS document_offer_options (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, quantity INTEGER NOT NULL, supplier_unit_price REAL NOT NULL, supplier_total REAL NOT NULL, UNIQUE(document_id, quantity))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS document_attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE, kind TEXT NOT NULL, file_name TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS backend_users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL DEFAULT 'operator', password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS workflow_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, request_template TEXT NOT NULL, offer_template TEXT NOT NULL, order_template TEXT NOT NULL, confirmation_template TEXT NOT NULL, reorder_point_subject TEXT, reorder_point_template TEXT, request_recipient TEXT NOT NULL DEFAULT 'supplier', offer_recipient TEXT NOT NULL DEFAULT 'customer', order_recipient TEXT NOT NULL DEFAULT 'system', confirmation_recipient TEXT NOT NULL DEFAULT 'customer', reorder_point_recipient TEXT NOT NULL DEFAULT 'customer', employee_login_subject TEXT NOT NULL DEFAULT 'Ihr Zugang zum Printcenter von {company}', employee_login_template TEXT NOT NULL DEFAULT 'Guten Tag {salutation} {lastName},\\n\\nIhr persönlicher Zugang zum Kundenportal von {company} ist eingerichtet.\\n\\nPortal: {portalUrl}\\nLogin: {email}\\nPasswort: {password}\\n\\nBitte bewahren Sie diese Zugangsdaten sicher auf.\\n\\nFreundliche Grüsse\\nPrintcenter', backend_password_reset_subject TEXT NOT NULL DEFAULT 'Passwort für Printcenter zurücksetzen', backend_password_reset_template TEXT NOT NULL DEFAULT 'Guten Tag {name},\\n\\nüber den folgenden Link können Sie Ihr Passwort für das Printcenter-Backend neu setzen:\\n\\n{resetUrl}\\n\\nDer Link ist {expiresIn} gültig und kann nur einmal verwendet werden. Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.\\n\\nFreundliche Grüsse\\nPrintcenter', supplier_offer_subject TEXT NOT NULL, offer_email TEXT NOT NULL, order_email TEXT NOT NULL, attach_request_document INTEGER NOT NULL DEFAULT 1, attach_request_gzd INTEGER NOT NULL DEFAULT 1, attach_offer_document INTEGER NOT NULL DEFAULT 1, attach_offer_gzd INTEGER NOT NULL DEFAULT 1, attach_order_document INTEGER NOT NULL DEFAULT 1, attach_order_gzd INTEGER NOT NULL DEFAULT 1, attach_confirmation_document INTEGER NOT NULL DEFAULT 1, attach_confirmation_gzd INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS integration_settings (id INTEGER PRIMARY KEY, navision_endpoint TEXT NOT NULL DEFAULT '', navision_tenant TEXT NOT NULL DEFAULT '', api_base_url TEXT NOT NULL DEFAULT '', api_client_id TEXT NOT NULL DEFAULT '', ftp_protocol TEXT NOT NULL DEFAULT 'SFTP', ftp_host TEXT NOT NULL DEFAULT '', ftp_port TEXT NOT NULL DEFAULT '22', ftp_username TEXT NOT NULL DEFAULT '', ftp_directory TEXT NOT NULL DEFAULT '/printcenter', sftp_pull_interval_minutes INTEGER NOT NULL DEFAULT 60, sftp_csv_entity TEXT NOT NULL DEFAULT 'articles', sftp_csv_delimiter TEXT NOT NULL DEFAULT ';', sftp_csv_has_header INTEGER NOT NULL DEFAULT 1, sftp_csv_file_pattern TEXT NOT NULL DEFAULT '*.csv', sftp_csv_mapping_json TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS email_sender_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'custom', from_name TEXT NOT NULL, from_email TEXT NOT NULL, reply_to TEXT NOT NULL DEFAULT '', smtp_host TEXT NOT NULL, smtp_port INTEGER NOT NULL DEFAULT 587, security TEXT NOT NULL DEFAULT 'starttls', username TEXT NOT NULL, password_ciphertext TEXT, active INTEGER NOT NULL DEFAULT 1, is_default INTEGER NOT NULL DEFAULT 0, last_tested_at TEXT, last_test_status TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS navision_sync_log (id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL, entity_id INTEGER NOT NULL, direction TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', external_reference TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_articles_customer_id ON articles(customer_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_articles_supplier_id ON articles(supplier_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_gzd_templates_article_id_uploaded_at ON gzd_templates(article_id, uploaded_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_stock_events_article_id_occurred_at ON stock_events(article_id, occurred_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_projects_customer_id_status ON projects(customer_id, status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_projects_article_id ON projects(article_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_documents_type_status ON documents(type, status)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_documents_customer_id_issued_at ON documents(customer_id, issued_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_document_lines_document_id ON document_lines(document_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_document_offer_options_document_id ON document_offer_options(document_id)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_document_attachments_document_id_kind ON document_attachments(document_id, kind)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_email_sender_profiles_active_default ON email_sender_profiles(active, is_default)",
    ),
  ]);
  const documentColumns: Array<[string, string]> = [
    ["supplier_lead_time", "TEXT"],
    ["supplier_delivery_date", "TEXT"],
    ["supplier_delivery_note", "TEXT"],
    ["supplier_reference", "TEXT"],
    ["binding_delivery_confirmation_due", "TEXT"],
    ["requested_quantities_json", "TEXT NOT NULL DEFAULT '[]'"],
    ["request_text", "TEXT"],
    ["document_text", "TEXT"],
    ["supplier_note", "TEXT"],
    ["gzd_status", "TEXT"],
    ["attach_document", "INTEGER NOT NULL DEFAULT 1"],
    ["attach_gzd", "INTEGER NOT NULL DEFAULT 1"],
  ];
  for (const [column, definition] of documentColumns)
    await ensureColumn(db, "documents", column, definition);
  const articleColumns = await db
    .prepare("PRAGMA table_info(articles)")
    .all<{ name: string }>();
  const hasLegacyArticleName = articleColumns.results.some(
    (column) => column.name === "name",
  );
  await ensureColumn(
    db,
    "articles",
    "designation_1",
    "TEXT NOT NULL DEFAULT ''",
  );
  await ensureColumn(
    db,
    "articles",
    "designation_2",
    "TEXT NOT NULL DEFAULT ''",
  );
  if (hasLegacyArticleName)
    await db
      .prepare(
        "UPDATE articles SET designation_1 = name WHERE designation_1 = ''",
      )
      .run();
  await ensureColumn(
    db,
    "workflow_settings",
    "employee_login_subject",
    "TEXT",
  );
  await ensureColumn(
    db,
    "workflow_settings",
    "employee_login_template",
    "TEXT",
  );
  await ensureColumn(
    db,
    "workflow_settings",
    "customer_password_reset_subject",
    "TEXT",
  );
  await ensureColumn(
    db,
    "workflow_settings",
    "customer_password_reset_template",
    "TEXT",
  );
  await ensureColumn(
    db,
    "workflow_settings",
    "backend_password_reset_subject",
    "TEXT",
  );
  await ensureColumn(
    db,
    "workflow_settings",
    "backend_password_reset_template",
    "TEXT",
  );
  await ensureColumn(db, "workflow_settings", "reorder_point_subject", "TEXT");
  await ensureColumn(db, "workflow_settings", "reorder_point_template", "TEXT");
  await ensureColumn(db, "workflow_settings", "request_recipient", "TEXT NOT NULL DEFAULT 'supplier'");
  await ensureColumn(db, "workflow_settings", "offer_recipient", "TEXT NOT NULL DEFAULT 'customer'");
  await ensureColumn(db, "workflow_settings", "order_recipient", "TEXT NOT NULL DEFAULT 'system'");
  await ensureColumn(db, "workflow_settings", "confirmation_recipient", "TEXT NOT NULL DEFAULT 'customer'");
  await ensureColumn(db, "workflow_settings", "reorder_point_recipient", "TEXT NOT NULL DEFAULT 'customer'");
  await ensureColumn(
    db,
    "integration_settings",
    "sftp_pull_interval_minutes",
    "INTEGER NOT NULL DEFAULT 60",
  );
  await ensureColumn(
    db,
    "integration_settings",
    "sftp_csv_entity",
    "TEXT NOT NULL DEFAULT 'articles'",
  );
  await ensureColumn(
    db,
    "integration_settings",
    "sftp_csv_delimiter",
    "TEXT NOT NULL DEFAULT ';'",
  );
  await ensureColumn(
    db,
    "integration_settings",
    "sftp_csv_has_header",
    "INTEGER NOT NULL DEFAULT 1",
  );
  await ensureColumn(
    db,
    "integration_settings",
    "sftp_csv_file_pattern",
    "TEXT NOT NULL DEFAULT '*.csv'",
  );
  await ensureColumn(
    db,
    "integration_settings",
    "sftp_csv_mapping_json",
    "TEXT NOT NULL DEFAULT '[]'",
  );
  await db.prepare("PRAGMA optimize").run();
}

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

type EmailSecurity = "tls" | "starttls" | "none";
type EmailSenderRow = {
  id: number;
  label: string;
  provider: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  smtp_host: string;
  smtp_port: number;
  security: EmailSecurity;
  username: string;
  password_ciphertext: string | null;
  active: number;
  is_default: number;
  last_tested_at: string | null;
  last_test_status: string | null;
  created_at: string;
  updated_at: string;
};
type EmailAttachment = {
  filename: string;
  contentType: string;
  contentBase64: string;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const base64ToBytes = (value: string) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};
const utf8Base64 = (value: string) =>
  bytesToBase64(new TextEncoder().encode(value));
const wrapBase64 = (value: string) => value.match(/.{1,76}/g)?.join("\r\n") ?? "";
const safeMailHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
const safeAttachmentName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "datei";
const safeContentType = (value: string) =>
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(value)
    ? value
    : "application/octet-stream";

async function emailEncryptionSecret(env: Env, db: D1Database) {
  if (env.EMAIL_ENCRYPTION_KEY?.trim()) return env.EMAIL_ENCRYPTION_KEY.trim();
  const stored = await db
    .prepare("SELECT value FROM app_meta WHERE key = 'email_encryption_key'")
    .first<{ value: string }>();
  if (stored?.value) return stored.value;
  const generated = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  await db
    .prepare(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('email_encryption_key', ?)",
    )
    .bind(generated)
    .run();
  return generated;
}

async function emailEncryptionKey(env: Env, db: D1Database) {
  const material = new TextEncoder().encode(
    await emailEncryptionSecret(env, db),
  );
  const digest = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptEmailPassword(
  env: Env,
  db: D1Database,
  password: string,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await emailEncryptionKey(env, db),
    new TextEncoder().encode(password),
  );
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`;
}

async function decryptEmailPassword(
  env: Env,
  db: D1Database,
  ciphertext: string,
) {
  const [version, iv, encrypted] = ciphertext.split(".");
  if (version !== "v1" || !iv || !encrypted)
    throw new Error("Das gespeicherte SMTP-Passwort ist ungültig.");
  const cleartext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    await emailEncryptionKey(env, db),
    base64ToBytes(encrypted),
  );
  return new TextDecoder().decode(cleartext);
}

const publicEmailSender = (row: EmailSenderRow) => ({
  id: Number(row.id),
  label: row.label,
  provider: row.provider,
  fromName: row.from_name,
  fromEmail: row.from_email,
  replyTo: row.reply_to,
  smtpHost: row.smtp_host,
  smtpPort: Number(row.smtp_port),
  security: row.security,
  username: row.username,
  passwordConfigured: Boolean(row.password_ciphertext),
  active: Boolean(row.active),
  isDefault: Boolean(row.is_default),
  lastTestedAt: row.last_tested_at,
  lastTestStatus: row.last_test_status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function readEmailSenders(db: D1Database) {
  await ensureFullSchema(db);
  const rows = await db
    .prepare(
      "SELECT * FROM email_sender_profiles ORDER BY is_default DESC, active DESC, label COLLATE NOCASE",
    )
    .all<EmailSenderRow>();
  return rows.results.map(publicEmailSender);
}

const validEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !/[\r\n]/.test(value);
const renderEmailTemplate = (
  template: string,
  values: Record<string, string | number>,
) =>
  Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
const validSmtpHost = (value: string) =>
  /^(?=.{1,253}$)(?!-)(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(
    value,
  ) &&
  value !== "localhost" &&
  !value.endsWith(".local");

function validateEmailSenderBody(body: Record<string, unknown>) {
  const label = String(body.label || "").trim();
  const fromName = String(body.fromName || "").trim();
  const fromEmail = String(body.fromEmail || "").trim();
  const replyTo = String(body.replyTo || "").trim();
  const smtpHost = String(body.smtpHost || "").trim().toLowerCase();
  const smtpPort = Number(body.smtpPort);
  const username = String(body.username || "").trim();
  const security = String(body.security || "starttls") as EmailSecurity;
  if (!label || !fromName || !username)
    throw new Error("Profilname, Absendername und Benutzername sind Pflichtfelder.");
  if (!validEmail(fromEmail) || (replyTo && !validEmail(replyTo)))
    throw new Error("Bitte gültige Absender- und Antwortadressen eingeben.");
  if (!validSmtpHost(smtpHost))
    throw new Error("Bitte einen gültigen öffentlichen SMTP-Host eingeben.");
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)
    throw new Error("Der SMTP-Port ist ungültig.");
  if (smtpPort === 25)
    throw new Error("SMTP-Port 25 ist nicht verfügbar. Bitte 465, 587 oder 2525 verwenden.");
  if (!(["tls", "starttls", "none"] as string[]).includes(security))
    throw new Error("Die gewählte SMTP-Verschlüsselung ist ungültig.");
  return {
    label,
    provider: String(body.provider || "custom"),
    fromName,
    fromEmail,
    replyTo,
    smtpHost,
    smtpPort,
    security,
    username,
    active: body.active !== false,
    isDefault: Boolean(body.isDefault) && body.active !== false,
  };
}

async function sendSmtpMessage(
  profile: EmailSenderRow,
  password: string,
  recipient: string,
  subject: string,
  body: string,
  attachments: EmailAttachment[] = [],
) {
  if (!validEmail(recipient))
    throw new Error("Bitte eine gültige Empfängeradresse eingeben.");
  const attachmentBytes = attachments.reduce(
    (total, attachment) => total + Math.ceil((attachment.contentBase64.length * 3) / 4),
    0,
  );
  if (attachments.some((attachment) => attachment.contentBase64.length > 11_200_000))
    throw new Error("Ein E-Mail-Anhang ist grösser als 8 MB.");
  if (attachmentBytes > 12_000_000)
    throw new Error("Die E-Mail-Anhänge sind zusammen grösser als 12 MB.");
  const { connect } = await import("cloudflare:sockets");
  let socket = connect(
    { hostname: profile.smtp_host, port: Number(profile.smtp_port) },
    {
      secureTransport:
        profile.security === "tls"
          ? "on"
          : profile.security === "starttls"
            ? "starttls"
            : "off",
      allowHalfOpen: false,
    },
  );
  await socket.opened;
  let reader = socket.readable.getReader();
  let writer = socket.writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let pending = "";
  const readResponse = async () => {
    const lines: string[] = [];
    while (true) {
      const lineEnd = pending.indexOf("\r\n");
      if (lineEnd >= 0) {
        const line = pending.slice(0, lineEnd);
        pending = pending.slice(lineEnd + 2);
        lines.push(line);
        if (/^\d{3} /.test(line)) return lines.join("\n");
        continue;
      }
      const result = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Zeitüberschreitung beim SMTP-Server.")), 15000),
        ),
      ]);
      if (result.done) throw new Error("Der SMTP-Server hat die Verbindung beendet.");
      pending += decoder.decode(result.value, { stream: true });
    }
  };
  const expect = async (codes: number[]) => {
    const response = await readResponse();
    const code = Number(response.slice(0, 3));
    if (!codes.includes(code))
      throw new Error(`SMTP ${code || "Fehler"}: ${response.replace(/\n/g, " · ").slice(0, 240)}`);
    return response;
  };
  const writeLine = (value: string) => writer.write(encoder.encode(`${value}\r\n`));
  try {
    await expect([220]);
    await writeLine("EHLO printcenter.local");
    await expect([250]);
    if (profile.security === "starttls") {
      await writeLine("STARTTLS");
      await expect([220]);
      reader.releaseLock();
      writer.releaseLock();
      socket = socket.startTls();
      await socket.opened;
      reader = socket.readable.getReader();
      writer = socket.writable.getWriter();
      pending = "";
      await writeLine("EHLO printcenter.local");
      await expect([250]);
    }
    await writeLine("AUTH LOGIN");
    await expect([334]);
    await writeLine(utf8Base64(profile.username));
    await expect([334]);
    await writeLine(utf8Base64(password));
    await expect([235]);
    await writeLine(`MAIL FROM:<${profile.from_email}>`);
    await expect([250]);
    await writeLine(`RCPT TO:<${recipient}>`);
    await expect([250, 251]);
    await writeLine("DATA");
    await expect([354]);
    const commonHeaders = [
      `From: =?UTF-8?B?${utf8Base64(safeMailHeader(profile.from_name))}?= <${profile.from_email}>`,
      `To: ${recipient}`,
      `Reply-To: ${profile.reply_to || profile.from_email}`,
      `Subject: =?UTF-8?B?${utf8Base64(safeMailHeader(subject))}?=`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@printcenter.local>`,
      "MIME-Version: 1.0",
    ];
    let message: string;
    if (!attachments.length) {
      message = [
        ...commonHeaders,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        wrapBase64(utf8Base64(body)),
      ].join("\r\n");
    } else {
      const boundary = `----=_Printcenter_${crypto.randomUUID()}`;
      const parts = [
        `--${boundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        wrapBase64(utf8Base64(body)),
      ];
      for (const attachment of attachments) {
        const filename = safeAttachmentName(attachment.filename);
        parts.push(
          `--${boundary}`,
          `Content-Type: ${safeContentType(attachment.contentType)}; name="${filename}"`,
          "Content-Transfer-Encoding: base64",
          `Content-Disposition: attachment; filename="${filename}"`,
          "",
          wrapBase64(attachment.contentBase64.replace(/\s+/g, "")),
        );
      }
      parts.push(`--${boundary}--`);
      message = [
        ...commonHeaders,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        "",
        ...parts,
      ].join("\r\n");
    }
    await writer.write(encoder.encode(`${message.replace(/^\./gm, "..")}\r\n.\r\n`));
    await expect([250]);
    await writeLine("QUIT");
    await expect([221]);
  } finally {
    reader.releaseLock();
    writer.releaseLock();
    await socket.close().catch(() => undefined);
  }
}

async function sendSmtpTest(
  profile: EmailSenderRow,
  password: string,
  recipient: string,
) {
  return sendSmtpMessage(
    profile,
    password,
    recipient,
    "Printcenter – SMTP-Test erfolgreich",
    [
      "Diese Testmail wurde über das Printcenter versendet.",
      "",
      `Absenderprofil: ${profile.label}`,
      `SMTP-Server: ${profile.smtp_host}:${profile.smtp_port}`,
      "",
      "Die Verbindung und Anmeldung funktionieren.",
    ].join("\r\n"),
  );
}

async function sendRequestEmails(
  body: Record<string, unknown>,
  request: Request,
  url: URL,
  env: Env,
  db: D1Database,
) {
  if (!sameOriginRequest(request, url, env))
    return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });

  await ensureFullSchema(db);
  const customerId = Number(body.customerId);
  const employeeId = Number(body.employeeId);
  const articleId = Number(body.articleId);
  const projectId = Number(body.projectId);
  const requestNumber = safeMailHeader(String(body.number || ""));
  const supplierToken = safeMailHeader(String(body.supplierToken || ""));
  const deliveryDate = String(body.deliveryDate || "").trim();
  const note = String(body.note || "").trim().slice(0, 5000);
  const quantities = (Array.isArray(body.quantities) ? body.quantities : [])
    .map(Number)
    .filter((quantity) => Number.isInteger(quantity) && quantity > 0)
    .slice(0, 5);
  if (
    !Number.isInteger(customerId) ||
    !Number.isInteger(employeeId) ||
    !Number.isInteger(articleId) ||
    !Number.isInteger(projectId) ||
    projectId <= 0 ||
    !/^AF-\d{4}-\d{3,}$/.test(requestNumber) ||
    !/^SUP-\d{6,}$/.test(supplierToken) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) ||
    !quantities.length
  )
    return json(
      { error: "Die Anfragedaten für den Mailversand sind unvollständig." },
      { status: 400 },
    );

  const requestRow = await db
    .prepare(
      "SELECT a.id AS article_id, a.sku, a.designation_1, a.designation_2, a.supplier_id, a.supplier_group_id, c.id AS customer_id, c.name AS customer_name, c.email AS customer_email, c.markup_percent, e.id AS employee_id, e.name AS employee_name, e.email AS employee_email, e.mail_to_main, s.name AS supplier_name, g.name AS group_name FROM articles a JOIN customers c ON c.id = a.customer_id JOIN customer_employees e ON e.id = ? AND e.customer_id = c.id AND e.active = 1 LEFT JOIN suppliers s ON s.id = a.supplier_id LEFT JOIN supplier_groups g ON g.id = a.supplier_group_id WHERE a.id = ? AND c.id = ?",
    )
    .bind(employeeId, articleId, customerId)
    .first<Record<string, string | number | null>>();
  if (!requestRow)
    return json(
      { error: "Kunde, Mitarbeiter oder Artikel konnte nicht verifiziert werden." },
      { status: 404 },
    );

  let recipientRows: Array<Record<string, string | number | null>> = [];
  let targetLabel = "Lieferant";
  if (requestRow.supplier_id != null) {
    const supplier = await db
      .prepare("SELECT id, name, email FROM suppliers WHERE id = ?")
      .bind(Number(requestRow.supplier_id))
      .first<Record<string, string | number | null>>();
    if (supplier) {
      recipientRows = [supplier];
      targetLabel = String(supplier.name);
    }
  } else if (requestRow.supplier_group_id != null) {
    const suppliers = await db
      .prepare(
        "SELECT id, name, email FROM suppliers WHERE group_id = ? ORDER BY name COLLATE NOCASE",
      )
      .bind(Number(requestRow.supplier_group_id))
      .all<Record<string, string | number | null>>();
    recipientRows = suppliers.results;
    targetLabel = `Lieferantengruppe · ${String(requestRow.group_name || "")}`;
  }
  const supplierRecipients = Array.from(
    new Set(
      recipientRows
        .map((row) => String(row.email || "").trim().toLowerCase())
        .filter(validEmail),
    ),
  );

  const sender = await db
    .prepare(
      "SELECT * FROM email_sender_profiles WHERE active = 1 ORDER BY is_default DESC, id LIMIT 1",
    )
    .first<EmailSenderRow>();
  if (!sender?.password_ciphertext)
    return json(
      {
        error:
          "Bitte zuerst unter E-Mail-Einstellungen einen aktiven SMTP-Absender einrichten.",
      },
      { status: 400 },
    );
  const workflow = await db
    .prepare(
      "SELECT request_template, request_recipient, supplier_offer_subject, attach_request_document, attach_request_gzd FROM workflow_settings ORDER BY id LIMIT 1",
    )
    .first<Record<string, string | number | null>>();
  if (!workflow)
    return json(
      { error: "Die Anfragevorlage wurde nicht gefunden." },
      { status: 500 },
    );
  const customerRecipients = Array.from(
    new Set(
      [
        String(requestRow.employee_email || "").trim().toLowerCase(),
        Number(requestRow.mail_to_main)
          ? String(requestRow.customer_email || "").trim().toLowerCase()
          : "",
      ].filter(validEmail),
    ),
  );
  const recipientKind = String(workflow.request_recipient || "supplier");
  const recipients =
    recipientKind === "customer"
      ? customerRecipients
      : recipientKind === "system"
        ? [String(sender.from_email).trim().toLowerCase()].filter(validEmail)
        : supplierRecipients;
  if (!recipients.length)
    return json(
      { error: "Für den gewählten Workflow-Empfänger ist keine gültige E-Mail-Adresse hinterlegt." },
      { status: 400 },
    );

  const article = [
    String(requestRow.designation_1 || ""),
    String(requestRow.designation_2 || ""),
  ]
    .filter(Boolean)
    .join(" · ");
  const quantitiesText = quantities
    .map((quantity) => `${quantity} Stück`)
    .join(", ");
  const supplierLink = `${publicAppOrigin(env, url)}/supplier-offer/${encodeURIComponent(supplierToken)}`;
  const values = {
    supplier: targetLabel,
    customer: String(requestRow.customer_name),
    article,
    quantity: quantitiesText,
    quantities: quantitiesText,
    deliveryDate,
    note: note || "Keine Bemerkung",
    project: projectId,
    requestNumber,
    supplierLink,
  };
  const requestText = renderEmailTemplate(
    String(workflow.request_template || "").replaceAll("\\n", "\n"),
    values,
  );
  const actionText = [
    "Anfrage online beantworten:",
    supplierLink,
    `Anfragenummer: ${requestNumber}`,
  ].join("\n");
  const messageBody = requestText.includes(supplierLink)
    ? `${requestText}\n\nAnfragenummer: ${requestNumber}`
    : `${requestText}\n\n${actionText}`;
  const subject = renderEmailTemplate(
    String(workflow.supplier_offer_subject || "Neue Anfrage {project}"),
    values,
  );

  const attachments: EmailAttachment[] = [];
  const warnings: string[] = [];
  if (Number(workflow.attach_request_document)) {
    const pdfDataUri = await createDocumentPdfDataUri({
      number: requestNumber,
      type: "Anfrage",
      status: "Versendet",
      date: new Intl.DateTimeFormat("de-CH").format(new Date()),
      customer: String(requestRow.customer_name),
      employee: String(requestRow.employee_name),
      supplier: targetLabel,
      projectId,
      article,
      quantity: quantities[0],
      requestedQuantities: quantities,
      unitPrice: 0,
      subtotal: 0,
      markupPercent: Number(requestRow.markup_percent || 0),
      markupAmount: 0,
      total: 0,
      deliveryDate,
      note,
      documentText: requestText,
      printFile: String(body.printFile || "") || undefined,
    });
    const pdfBase64 = pdfDataUri.slice(pdfDataUri.indexOf(",") + 1);
    attachments.push({
      filename: `${requestNumber}.pdf`,
      contentType: "application/pdf",
      contentBase64: pdfBase64,
    });
  }
  if (Number(workflow.attach_request_gzd) && body.printFileUrl) {
    try {
      const fileUrl = new URL(String(body.printFileUrl), url.origin);
      if (
        !requestOrigins(request, url, env).has(fileUrl.origin) ||
        !fileUrl.pathname.startsWith("/api/files/")
      )
        throw new Error("ungültiger Dateipfad");
      const key = decodeURIComponent(fileUrl.pathname.slice("/api/files/".length));
      const object = await env.FILES.get(key);
      if (!object) throw new Error("Datei nicht gefunden");
      if (object.size > 8_000_000) throw new Error("Datei ist grösser als 8 MB");
      attachments.push({
        filename: String(body.printFile || "gut-zum-druck"),
        contentType: object.httpMetadata?.contentType || "application/octet-stream",
        contentBase64: bytesToBase64(
          new Uint8Array(await object.arrayBuffer()),
        ),
      });
    } catch (error) {
      warnings.push(
        `Das GzD konnte nicht angehängt werden (${error instanceof Error ? error.message : "unbekannter Fehler"}).`,
      );
    }
  }

  const password = await decryptEmailPassword(
    env,
    db,
    sender.password_ciphertext,
  );
  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      sendSmtpMessage(
        sender,
        password,
        recipient,
        subject,
        messageBody,
        attachments,
      ),
    ),
  );
  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;
  if (!sent) {
    const firstFailure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    return json(
      {
        error:
          firstFailure?.reason instanceof Error
            ? firstFailure.reason.message
            : "Die Lieferantenmail konnte nicht versendet werden.",
      },
      { status: 502 },
    );
  }
  return json({
    ok: true,
    sent,
    failed,
    attachmentCount: attachments.length,
    warning: warnings.join(" "),
    message:
      failed > 0
        ? `${sent} Lieferantenmail(s) versendet, ${failed} fehlgeschlagen.`
        : `${sent} Lieferantenmail(s) erfolgreich versendet.`,
  });
}

async function mailAttachmentFromStoredFile(
  env: Env,
  origins: Set<string>,
  fileUrl: string,
  filename: string,
) {
  const fallbackOrigin = origins.values().next().value;
  if (!fallbackOrigin) throw new Error("ungültiger Dateipfad");
  const parsedUrl = new URL(fileUrl, fallbackOrigin);
  if (
    !origins.has(parsedUrl.origin) ||
    !parsedUrl.pathname.startsWith("/api/files/")
  )
    throw new Error("ungültiger Dateipfad");
  const key = decodeURIComponent(parsedUrl.pathname.slice("/api/files/".length));
  const object = await env.FILES.get(key);
  if (!object) throw new Error("Datei nicht gefunden");
  if (object.size > 8_000_000) throw new Error("Datei ist grösser als 8 MB");
  return {
    filename,
    contentType: object.httpMetadata?.contentType || "application/octet-stream",
    contentBase64: bytesToBase64(new Uint8Array(await object.arrayBuffer())),
  } satisfies EmailAttachment;
}

async function sendCollectiveRequestEmails(
  body: Record<string, unknown>,
  request: Request,
  url: URL,
  env: Env,
  db: D1Database,
) {
  if (!sameOriginRequest(request, url, env))
    return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });
  await ensureFullSchema(db);
  const customerId = Number(body.customerId);
  const employeeId = Number(body.employeeId);
  const projectId = Number(body.projectId);
  const requestNumber = safeMailHeader(String(body.number || ""));
  const supplierToken = safeMailHeader(String(body.supplierToken || ""));
  const deliveryDate = String(body.deliveryDate || "").trim();
  const note = String(body.note || "").trim().slice(0, 5000);
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems.slice(0, 30).map((rawItem) => {
    const item = rawItem as Record<string, unknown>;
    return {
      articleId: Number(item.articleId),
      quantities: (Array.isArray(item.quantities) ? item.quantities : [])
        .map(Number)
        .filter((quantity) => Number.isInteger(quantity) && quantity > 0)
        .slice(0, 5),
      printFile: String(item.printFile || "").trim().slice(0, 240),
      printFileUrl: String(item.printFileUrl || "").trim(),
    };
  });
  if (
    !Number.isInteger(customerId) ||
    !Number.isInteger(employeeId) ||
    !Number.isInteger(projectId) ||
    projectId <= 0 ||
    !/^AF-\d{4}-\d{3,}$/.test(requestNumber) ||
    !/^SUP-\d{6,}$/.test(supplierToken) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) ||
    !items.length ||
    items.length !== rawItems.length ||
    items.some(
      (item) =>
        !Number.isInteger(item.articleId) ||
        item.articleId <= 0 ||
        !item.quantities.length,
    ) ||
    new Set(items.map((item) => item.articleId)).size !== items.length
  )
    return json(
      { error: "Die Sammelanfrage ist unvollständig oder ungültig." },
      { status: 400 },
    );
  const employee = await db
    .prepare(
      "SELECT e.name, e.email AS employee_email, e.mail_to_main, c.name AS customer_name, c.email AS customer_email, c.markup_percent FROM customer_employees e JOIN customers c ON c.id = e.customer_id WHERE e.id = ? AND e.customer_id = ? AND e.active = 1",
    )
    .bind(employeeId, customerId)
    .first<Record<string, string | number | null>>();
  if (!employee)
    return json(
      { error: "Der Kundenmitarbeiter konnte nicht verifiziert werden." },
      { status: 404 },
    );
  const placeholders = items.map(() => "?").join(", ");
  const articleRows = await db
    .prepare(
      `SELECT a.id, a.sku, a.designation_1, a.designation_2, a.supplier_id, a.supplier_group_id, s.name AS supplier_name, g.name AS group_name FROM articles a LEFT JOIN suppliers s ON s.id = a.supplier_id LEFT JOIN supplier_groups g ON g.id = a.supplier_group_id WHERE a.customer_id = ? AND a.id IN (${placeholders})`,
    )
    .bind(customerId, ...items.map((item) => item.articleId))
    .all<Record<string, string | number | null>>();
  if (articleRows.results.length !== items.length)
    return json(
      { error: "Mindestens ein Artikel gehört nicht zu diesem Kunden." },
      { status: 400 },
    );
  const firstArticle = articleRows.results[0];
  const sameSupplier = articleRows.results.every(
    (row) =>
      String(row.supplier_id ?? "") ===
        String(firstArticle.supplier_id ?? "") &&
      String(row.supplier_group_id ?? "") ===
        String(firstArticle.supplier_group_id ?? ""),
  );
  if (
    !sameSupplier ||
    (firstArticle.supplier_id == null && firstArticle.supplier_group_id == null)
  )
    return json(
      {
        error:
          "Alle Artikel einer Sammelanfrage müssen denselben Lieferanten haben.",
      },
      { status: 400 },
    );
  let recipientRows: Array<Record<string, string | number | null>> = [];
  let targetLabel = "Lieferant";
  if (firstArticle.supplier_id != null) {
    const supplier = await db
      .prepare("SELECT id, name, email FROM suppliers WHERE id = ?")
      .bind(Number(firstArticle.supplier_id))
      .first<Record<string, string | number | null>>();
    if (supplier) {
      recipientRows = [supplier];
      targetLabel = String(supplier.name);
    }
  } else {
    const suppliers = await db
      .prepare(
        "SELECT id, name, email FROM suppliers WHERE group_id = ? ORDER BY name COLLATE NOCASE",
      )
      .bind(Number(firstArticle.supplier_group_id))
      .all<Record<string, string | number | null>>();
    recipientRows = suppliers.results;
    targetLabel = `Lieferantengruppe · ${String(firstArticle.group_name || "")}`;
  }
  const supplierRecipients = Array.from(
    new Set(
      recipientRows
        .map((row) => String(row.email || "").trim().toLowerCase())
        .filter(validEmail),
    ),
  );
  const sender = await db
    .prepare(
      "SELECT * FROM email_sender_profiles WHERE active = 1 ORDER BY is_default DESC, id LIMIT 1",
    )
    .first<EmailSenderRow>();
  if (!sender?.password_ciphertext)
    return json(
      {
        error:
          "Bitte zuerst unter E-Mail-Einstellungen einen aktiven SMTP-Absender einrichten.",
      },
      { status: 400 },
    );
  const workflow = await db
    .prepare(
      "SELECT request_template, request_recipient, supplier_offer_subject, attach_request_document, attach_request_gzd FROM workflow_settings ORDER BY id LIMIT 1",
    )
    .first<Record<string, string | number | null>>();
  if (!workflow)
    return json({ error: "Die Anfragevorlage fehlt." }, { status: 500 });
  const customerRecipients = Array.from(
    new Set(
      [
        String(employee.employee_email || "").trim().toLowerCase(),
        Number(employee.mail_to_main)
          ? String(employee.customer_email || "").trim().toLowerCase()
          : "",
      ].filter(validEmail),
    ),
  );
  const recipientKind = String(workflow.request_recipient || "supplier");
  const recipients =
    recipientKind === "customer"
      ? customerRecipients
      : recipientKind === "system"
        ? [String(sender.from_email).trim().toLowerCase()].filter(validEmail)
        : supplierRecipients;
  if (!recipients.length)
    return json(
      { error: "Für den gewählten Workflow-Empfänger ist keine gültige E-Mail-Adresse hinterlegt." },
      { status: 400 },
    );
  const rowsById = new Map(
    articleRows.results.map((row) => [Number(row.id), row]),
  );
  const pdfItems: StateDocumentItem[] = items.map((item) => {
    const row = rowsById.get(item.articleId)!;
    return {
      articleId: item.articleId,
      sku: String(row.sku),
      article: [String(row.designation_1 || ""), String(row.designation_2 || "")]
        .filter(Boolean)
        .join(" · "),
      quantity: item.quantities[0],
      requestedQuantities: item.quantities,
      unitPrice: 0,
      subtotal: 0,
      markupAmount: 0,
      total: 0,
      printFile: item.printFile || undefined,
      printFileUrl: item.printFileUrl || undefined,
    };
  });
  const supplierLink = `${publicAppOrigin(env, url)}/supplier-offer/${encodeURIComponent(supplierToken)}`;
  const values = {
    supplier: targetLabel,
    customer: String(employee.customer_name),
    article: `Sammelanfrage mit ${pdfItems.length} Artikeln`,
    quantity: `${pdfItems.length} Artikel`,
    quantities: "individuelle Staffelgrössen pro Artikel",
    deliveryDate,
    note: note || "Keine Bemerkung",
    project: projectId,
    requestNumber,
    supplierLink,
  };
  const requestText = renderEmailTemplate(
    String(workflow.request_template || "").replaceAll("\\n", "\n"),
    values,
  );
  const messageBody = `${requestText}\n\nSammelanfrage online beantworten:\n${supplierLink}\nAnfragenummer: ${requestNumber}`;
  const subject = renderEmailTemplate(
    String(workflow.supplier_offer_subject || "Neue Anfrage {project}"),
    values,
  );
  const attachments: EmailAttachment[] = [];
  const warnings: string[] = [];
  if (Number(workflow.attach_request_document)) {
    const pdfDataUri = await createDocumentPdfDataUri({
      number: requestNumber,
      type: "Anfrage",
      status: "Versendet",
      date: new Intl.DateTimeFormat("de-CH").format(new Date()),
      customer: String(employee.customer_name),
      employee: String(employee.name),
      supplier: targetLabel,
      projectId,
      article: `Sammelanfrage · ${pdfItems.length} Artikel`,
      quantity: pdfItems[0].quantity,
      unitPrice: 0,
      subtotal: 0,
      markupPercent: Number(employee.markup_percent || 0),
      markupAmount: 0,
      total: 0,
      deliveryDate,
      note,
      documentText: requestText,
      items: pdfItems,
    });
    attachments.push({
      filename: `${requestNumber}.pdf`,
      contentType: "application/pdf",
      contentBase64: pdfDataUri.slice(pdfDataUri.indexOf(",") + 1),
    });
  }
  if (Number(workflow.attach_request_gzd)) {
    let attachedBytes = 0;
    for (const item of pdfItems) {
      if (!item.printFile || !item.printFileUrl) continue;
      try {
        const attachment = await mailAttachmentFromStoredFile(
          env,
          requestOrigins(request, url, env),
          item.printFileUrl,
          `${item.sku}-${item.printFile}`,
        );
        const estimatedBytes = Math.ceil(
          (attachment.contentBase64.length * 3) / 4,
        );
        if (attachedBytes + estimatedBytes > 9_000_000) {
          warnings.push("Weitere GzDs wurden wegen der E-Mail-Grösse ausgelassen.");
          break;
        }
        attachments.push(attachment);
        attachedBytes += estimatedBytes;
      } catch (error) {
        warnings.push(
          `${item.sku}: GzD nicht angehängt (${error instanceof Error ? error.message : "Fehler"}).`,
        );
      }
    }
  }
  const password = await decryptEmailPassword(
    env,
    db,
    sender.password_ciphertext,
  );
  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      sendSmtpMessage(
        sender,
        password,
        recipient,
        subject,
        messageBody,
        attachments,
      ),
    ),
  );
  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;
  if (!sent)
    return json(
      { error: "Die Sammelanfrage-Mail konnte nicht versendet werden." },
      { status: 502 },
    );
  return json({
    ok: true,
    sent,
    failed,
    warning: warnings.join(" "),
    message: `${sent} Lieferantenmail(s) erfolgreich versendet.`,
  });
}

async function sendCollectiveOfferEmails(
  body: Record<string, unknown>,
  request: Request,
  url: URL,
  env: Env,
  db: D1Database,
) {
  if (!sameOriginRequest(request, url, env))
    return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });
  await ensureFullSchema(db);
  const requestId = Number(body.requestId);
  const supplierToken = safeMailHeader(String(body.supplierToken || ""));
  const offerNumber = safeMailHeader(String(body.offerNumber || ""));
  const deliveryDate = String(body.deliveryDate || "").trim();
  const deliveryNote = String(body.deliveryNote || "").trim().slice(0, 3000);
  const supplierNote = String(body.note || "").trim().slice(0, 5000);
  const rawItems = Array.isArray(body.items) ? body.items : [];
  const submittedItems = rawItems.map((rawItem) => {
    const item = rawItem as Record<string, unknown>;
    const rawOptions = Array.isArray(item.options) ? item.options : [];
    return {
      articleId: Number(item.articleId),
      gzd: String(item.gzd || "").trim().slice(0, 240),
      gzdUrl: String(item.gzdUrl || "").trim(),
      options: rawOptions.map((rawOption) => {
        const option = rawOption as Record<string, unknown>;
        return {
          quantity: Number(option.quantity),
          unitPrice: Number(option.unitPrice),
          supplierTotal: Number(option.supplierTotal),
        };
      }),
    };
  });
  if (
    !Number.isInteger(requestId) ||
    requestId <= 0 ||
    !/^SUP-\d{6,}$/.test(supplierToken) ||
    !/^AN-\d{4}-\d{3,}$/.test(offerNumber) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) ||
    !submittedItems.length ||
    submittedItems.some(
      (item) =>
        !Number.isInteger(item.articleId) ||
        !item.options.length ||
        item.options.length > 5 ||
        item.options.some(
          (option) =>
            !Number.isInteger(option.quantity) ||
            option.quantity <= 0 ||
            !Number.isFinite(option.unitPrice) ||
            option.unitPrice <= 0 ||
            !Number.isFinite(option.supplierTotal) ||
            option.supplierTotal <= 0 ||
            Math.abs(option.unitPrice * option.quantity - option.supplierTotal) >
              Math.max(0.02, option.supplierTotal * 0.0001),
        ),
    )
  )
    return json(
      { error: "Die Sammelofferte ist unvollständig oder ungültig." },
      { status: 400 },
    );
  const requestRow = await db
    .prepare(
      "SELECT d.id, d.project_id, d.payload, d.supplier_id, c.name AS customer_name, c.customer_number, c.email AS customer_email, c.markup_percent, e.name AS employee_name, e.email AS employee_email, e.mail_to_main, s.email AS supplier_email FROM documents d JOIN customers c ON c.id = d.customer_id JOIN customer_employees e ON e.id = d.customer_employee_id AND e.customer_id = c.id AND e.active = 1 LEFT JOIN suppliers s ON s.id = d.supplier_id WHERE d.id = ? AND d.type = 'Anfrage' AND d.status = 'Versendet' AND d.supplier_token = ? LIMIT 1",
    )
    .bind(requestId, supplierToken)
    .first<Record<string, string | number | null>>();
  if (!requestRow)
    return json(
      { error: "Der einmalige Lieferantenlink ist nicht mehr gültig." },
      { status: 404 },
    );
  const requestPayload = parseJson<StateDocument>(
    String(requestRow.payload || "{}"),
    {} as StateDocument,
  );
  if (!requestPayload.items?.length)
    return json(
      { error: "Die Artikel der Sammelanfrage wurden nicht gefunden." },
      { status: 400 },
    );
  if (
    requestPayload.items.length !== submittedItems.length ||
    requestPayload.items.some((requestItem) => {
      const submitted = submittedItems.find(
        (item) => item.articleId === requestItem.articleId,
      );
      const expected = (requestItem.requestedQuantities ?? [requestItem.quantity])
        .slice()
        .sort((left, right) => left - right);
      const offered = (submitted?.options ?? [])
        .map((option) => option.quantity)
        .sort((left, right) => left - right);
      return (
        !submitted ||
        expected.length !== offered.length ||
        expected.some((quantity, index) => quantity !== offered[index])
      );
    })
  )
    return json(
      {
        error:
          "Artikel oder Staffelgrössen stimmen nicht mit der Sammelanfrage überein.",
      },
      { status: 400 },
    );
  const customerRecipients = Array.from(
    new Set(
      [
        String(requestRow.employee_email || "").trim().toLowerCase(),
        Number(requestRow.mail_to_main)
          ? String(requestRow.customer_email || "").trim().toLowerCase()
          : "",
      ].filter(validEmail),
    ),
  );
  const sender = await db
    .prepare(
      "SELECT * FROM email_sender_profiles WHERE active = 1 ORDER BY is_default DESC, id LIMIT 1",
    )
    .first<EmailSenderRow>();
  if (!sender?.password_ciphertext)
    return json(
      { error: "Es ist kein aktiver SMTP-Absender eingerichtet." },
      { status: 400 },
    );
  const workflow = await db
    .prepare(
      "SELECT offer_template, offer_recipient, attach_offer_document, attach_offer_gzd FROM workflow_settings ORDER BY id LIMIT 1",
    )
    .first<Record<string, string | number | null>>();
  if (!workflow)
    return json({ error: "Die Angebotsvorlage fehlt." }, { status: 500 });
  const recipientKind = String(workflow.offer_recipient || "customer");
  const recipients =
    recipientKind === "supplier"
      ? [String(requestRow.supplier_email || "").trim().toLowerCase()].filter(
          validEmail,
        )
      : recipientKind === "system"
        ? [String(sender.from_email).trim().toLowerCase()].filter(validEmail)
        : customerRecipients;
  if (!recipients.length)
    return json(
      { error: "Für den gewählten Workflow-Empfänger ist keine gültige E-Mail-Adresse hinterlegt." },
      { status: 400 },
    );
  const markupPercent = Number(requestRow.markup_percent || 0);
  const offerItems: StateDocumentItem[] = requestPayload.items.map(
    (requestItem) => {
      const submitted = submittedItems.find(
        (item) => item.articleId === requestItem.articleId,
      )!;
      const firstOption = submitted.options[0];
      const subtotal = firstOption.supplierTotal;
      const markupAmount = (subtotal * markupPercent) / 100;
      return {
        ...requestItem,
        quantity: firstOption.quantity,
        unitPrice: firstOption.unitPrice,
        subtotal,
        markupAmount,
        total: subtotal + markupAmount,
        supplierGzd: submitted.gzd || undefined,
        supplierGzdUrl:
          submitted.gzd === requestItem.printFile
            ? requestItem.printFileUrl
            : submitted.gzdUrl || undefined,
        gzdStatus: submitted.gzd ? "In Prüfung" : undefined,
        offerOptions: submitted.options,
      };
    },
  );
  const subtotal = offerItems.reduce((sum, item) => sum + item.subtotal, 0);
  const markupAmount = (subtotal * markupPercent) / 100;
  const total = subtotal + markupAmount;
  const projectId = Number(requestRow.project_id || requestPayload.projectId || requestId);
  const portalUrl = `${publicAppOrigin(env, url)}/${encodeURIComponent(String(requestRow.customer_number))}`;
  const values = {
    supplier: requestPayload.supplier || "Lieferant",
    customer: String(requestRow.customer_name),
    article: `Sammelofferte mit ${offerItems.length} Artikeln`,
    quantity: `${offerItems.length} Artikel`,
    quantities: "individuelle Staffelgrössen pro Artikel",
    deliveryDate,
    note: deliveryNote || supplierNote || "Keine Bemerkung",
    project: projectId,
    total: total.toFixed(2),
    offerNumber,
    portalUrl,
  };
  const offerText = renderEmailTemplate(
    String(workflow.offer_template || "").replaceAll("\\n", "\n"),
    values,
  );
  const messageBody = `${offerText}\n\nSammelofferte im Kundenportal öffnen:\n${portalUrl}\nAngebotsnummer: ${offerNumber}`;
  const attachments: EmailAttachment[] = [];
  const warnings: string[] = [];
  if (Number(workflow.attach_offer_document)) {
    const pdfDataUri = await createDocumentPdfDataUri({
      number: offerNumber,
      type: "Angebot",
      status: "Offen",
      date: new Intl.DateTimeFormat("de-CH").format(new Date()),
      customer: String(requestRow.customer_name),
      employee: String(requestRow.employee_name),
      supplier: requestPayload.supplier,
      projectId,
      article: `Sammelofferte · ${offerItems.length} Artikel`,
      quantity: offerItems[0].quantity,
      unitPrice: offerItems[0].unitPrice,
      subtotal,
      markupPercent,
      markupAmount,
      total,
      deliveryDate: requestPayload.deliveryDate,
      supplierDeliveryDate: deliveryDate,
      supplierDeliveryNote: deliveryNote || undefined,
      note: supplierNote,
      documentText: offerText,
      items: offerItems,
    });
    attachments.push({
      filename: `${offerNumber}.pdf`,
      contentType: "application/pdf",
      contentBase64: pdfDataUri.slice(pdfDataUri.indexOf(",") + 1),
    });
  }
  if (Number(workflow.attach_offer_gzd)) {
    let attachedBytes = 0;
    for (const item of offerItems) {
      if (!item.supplierGzd || !item.supplierGzdUrl) continue;
      try {
        const attachment = await mailAttachmentFromStoredFile(
          env,
          requestOrigins(request, url, env),
          item.supplierGzdUrl,
          `${item.sku}-${item.supplierGzd}`,
        );
        const estimatedBytes = Math.ceil(
          (attachment.contentBase64.length * 3) / 4,
        );
        if (attachedBytes + estimatedBytes > 9_000_000) {
          warnings.push("Weitere GzDs wurden wegen der E-Mail-Grösse ausgelassen.");
          break;
        }
        attachments.push(attachment);
        attachedBytes += estimatedBytes;
      } catch (error) {
        warnings.push(
          `${item.sku}: GzD nicht angehängt (${error instanceof Error ? error.message : "Fehler"}).`,
        );
      }
    }
  }
  const password = await decryptEmailPassword(
    env,
    db,
    sender.password_ciphertext,
  );
  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      sendSmtpMessage(
        sender,
        password,
        recipient,
        `Ihre Sammelofferte ${offerNumber}`,
        messageBody,
        attachments,
      ),
    ),
  );
  const sent = results.filter((result) => result.status === "fulfilled").length;
  if (!sent)
    return json(
      { error: "Die Sammelofferte-Mail konnte nicht versendet werden." },
      { status: 502 },
    );
  return json({
    ok: true,
    sent,
    failed: results.length - sent,
    attachmentCount: attachments.length,
    warning: warnings.join(" "),
    message: `${sent} Kundenmail(s) erfolgreich versendet.`,
  });
}

async function sendOfferEmails(
  body: Record<string, unknown>,
  request: Request,
  url: URL,
  env: Env,
  db: D1Database,
) {
  if (!sameOriginRequest(request, url, env))
    return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });

  await ensureFullSchema(db);
  const requestId = Number(body.requestId);
  const supplierToken = safeMailHeader(String(body.supplierToken || ""));
  const offerNumber = safeMailHeader(String(body.offerNumber || ""));
  const deliveryDate = String(body.deliveryDate || "").trim();
  const deliveryNote = String(body.deliveryNote || "").trim().slice(0, 3000);
  const supplierNote = String(body.note || "").trim().slice(0, 5000);
  const rawOptions = Array.isArray(body.options) ? body.options : [];
  const options = rawOptions.map((option) => {
    const row = option as Record<string, unknown>;
    return {
      quantity: Number(row.quantity),
      unitPrice: Number(row.unitPrice),
      supplierTotal: Number(row.supplierTotal),
    };
  });
  if (
    !Number.isInteger(requestId) ||
    requestId <= 0 ||
    !/^SUP-\d{6,}$/.test(supplierToken) ||
    !/^AN-\d{4}-\d{3,}$/.test(offerNumber) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) ||
    !options.length ||
    options.length > 5 ||
    options.some(
      (option) =>
        !Number.isInteger(option.quantity) ||
        option.quantity <= 0 ||
        !Number.isFinite(option.unitPrice) ||
        option.unitPrice <= 0 ||
        !Number.isFinite(option.supplierTotal) ||
        option.supplierTotal <= 0 ||
        Math.abs(option.unitPrice * option.quantity - option.supplierTotal) >
          Math.max(0.02, option.supplierTotal * 0.0001),
    )
  )
    return json(
      { error: "Die Angebotsdaten für den Mailversand sind unvollständig." },
      { status: 400 },
    );

  const requestRow = await db
    .prepare(
      "SELECT d.id, d.document_number, d.customer_id, d.customer_employee_id, d.project_id, d.supplier_id, d.requested_quantities_json, d.payload, c.name AS customer_name, c.customer_number, c.email AS customer_email, c.markup_percent, e.name AS employee_name, e.email AS employee_email, e.mail_to_main, a.id AS article_id, a.sku, a.designation_1, a.designation_2, s.name AS supplier_name, s.email AS supplier_email FROM documents d JOIN customers c ON c.id = d.customer_id JOIN customer_employees e ON e.id = d.customer_employee_id AND e.customer_id = c.id AND e.active = 1 LEFT JOIN document_lines dl ON dl.document_id = d.id LEFT JOIN articles a ON a.id = dl.article_id LEFT JOIN suppliers s ON s.id = d.supplier_id WHERE d.id = ? AND d.type = 'Anfrage' AND d.status = 'Versendet' AND d.supplier_token = ? LIMIT 1",
    )
    .bind(requestId, supplierToken)
    .first<Record<string, string | number | null>>();
  if (!requestRow)
    return json(
      { error: "Der einmalige Lieferantenlink ist nicht mehr gültig." },
      { status: 404 },
    );
  const requestPayload = parseJson<StateDocument>(
    String(requestRow.payload || "{}"),
    {} as StateDocument,
  );
  const storedRequestedQuantities = parseJson<number[]>(
    String(requestRow.requested_quantities_json || "[]"),
    [],
  );
  const expectedQuantities = (
    storedRequestedQuantities.length
      ? storedRequestedQuantities
      : requestPayload.requestedQuantities?.length
        ? requestPayload.requestedQuantities
        : [requestPayload.quantity]
  )
    .filter((quantity) => Number.isInteger(quantity) && quantity > 0)
    .sort((left, right) => left - right);
  const offeredQuantities = options
    .map((option) => option.quantity)
    .sort((left, right) => left - right);
  if (
    expectedQuantities.length !== offeredQuantities.length ||
    expectedQuantities.some(
      (quantity, index) => quantity !== offeredQuantities[index],
    )
  )
    return json(
      { error: "Die angebotenen Staffelmengen stimmen nicht mit der Anfrage überein." },
      { status: 400 },
    );

  const customerRecipients = Array.from(
    new Set(
      [
        String(requestRow.employee_email || "").trim().toLowerCase(),
        Number(requestRow.mail_to_main)
          ? String(requestRow.customer_email || "").trim().toLowerCase()
          : "",
      ].filter(validEmail),
    ),
  );
  const sender = await db
    .prepare(
      "SELECT * FROM email_sender_profiles WHERE active = 1 ORDER BY is_default DESC, id LIMIT 1",
    )
    .first<EmailSenderRow>();
  if (!sender?.password_ciphertext)
    return json(
      {
        error:
          "Bitte zuerst unter E-Mail-Einstellungen einen aktiven SMTP-Absender einrichten.",
      },
      { status: 400 },
    );
  const workflow = await db
    .prepare(
      "SELECT offer_template, offer_recipient, attach_offer_document, attach_offer_gzd FROM workflow_settings ORDER BY id LIMIT 1",
    )
    .first<Record<string, string | number | null>>();
  if (!workflow)
    return json(
      { error: "Die Angebotsvorlage wurde nicht gefunden." },
      { status: 500 },
    );
  const recipientKind = String(workflow.offer_recipient || "customer");
  const recipients =
    recipientKind === "supplier"
      ? [String(requestRow.supplier_email || "").trim().toLowerCase()].filter(
          validEmail,
        )
      : recipientKind === "system"
        ? [String(sender.from_email).trim().toLowerCase()].filter(validEmail)
        : customerRecipients;
  if (!recipients.length)
    return json(
      { error: "Für den gewählten Workflow-Empfänger ist keine gültige E-Mail-Adresse hinterlegt." },
      { status: 400 },
    );

  const article = [
    String(requestRow.designation_1 || requestPayload.article || ""),
    String(requestRow.designation_2 || ""),
  ]
    .filter(Boolean)
    .join(" · ");
  const markupPercent = Number(requestRow.markup_percent || 0);
  const firstOption = options[0];
  const subtotal = firstOption.supplierTotal;
  const markupAmount = (subtotal * markupPercent) / 100;
  const total = subtotal + markupAmount;
  const projectId = Number(requestRow.project_id || requestPayload.projectId || requestId);
  const portalUrl = `${publicAppOrigin(env, url)}/${encodeURIComponent(String(requestRow.customer_number))}`;
  const values = {
    supplier: String(requestRow.supplier_name || requestPayload.supplier || "Lieferant"),
    customer: String(requestRow.customer_name),
    article,
    quantity: firstOption.quantity,
    quantities: options.map((option) => `${option.quantity} Stück`).join(", "),
    deliveryDate,
    note: deliveryNote || supplierNote || "Keine Bemerkung",
    project: projectId,
    total: total.toFixed(2),
    offerNumber,
    portalUrl,
  };
  const offerText = renderEmailTemplate(
    String(workflow.offer_template || "").replaceAll("\\n", "\n"),
    values,
  );
  const messageBody = offerText.includes(portalUrl)
    ? `${offerText}\n\nAngebotsnummer: ${offerNumber}`
    : `${offerText}\n\nAngebot im Kundenportal öffnen:\n${portalUrl}\nAngebotsnummer: ${offerNumber}`;
  const subject = `Ihr Angebot ${offerNumber} für ${article}`;

  const requestedGzdName = String(body.gzd || "").trim().slice(0, 240);
  let requestedGzdUrl = String(body.gzdUrl || "").trim();
  if (requestedGzdName && requestedGzdName === requestPayload.printFile)
    requestedGzdUrl = requestPayload.printFileUrl || requestedGzdUrl;
  const attachments: EmailAttachment[] = [];
  const warnings: string[] = [];
  if (Number(workflow.attach_offer_document)) {
    const pdfDataUri = await createDocumentPdfDataUri({
      number: offerNumber,
      type: "Angebot",
      status: "Offen",
      date: new Intl.DateTimeFormat("de-CH").format(new Date()),
      customer: String(requestRow.customer_name),
      employee: String(requestRow.employee_name),
      supplier: String(requestRow.supplier_name || requestPayload.supplier || "Lieferant"),
      projectId,
      article,
      quantity: firstOption.quantity,
      unitPrice: firstOption.unitPrice,
      subtotal,
      markupPercent,
      markupAmount,
      total,
      deliveryDate: requestPayload.deliveryDate,
      supplierDeliveryDate: deliveryDate,
      supplierDeliveryNote: deliveryNote || undefined,
      note: supplierNote,
      documentText: offerText,
      printFile: requestPayload.printFile,
      supplierGzd: requestedGzdName || undefined,
      gzdStatus: requestedGzdName ? "In Prüfung" : undefined,
      offerOptions: options,
    });
    attachments.push({
      filename: `${offerNumber}.pdf`,
      contentType: "application/pdf",
      contentBase64: pdfDataUri.slice(pdfDataUri.indexOf(",") + 1),
    });
  }
  if (Number(workflow.attach_offer_gzd) && requestedGzdName) {
    if (requestedGzdUrl) {
      try {
        attachments.push(
          await mailAttachmentFromStoredFile(
            env,
            requestOrigins(request, url, env),
            requestedGzdUrl,
            requestedGzdName,
          ),
        );
      } catch (error) {
        warnings.push(
          `Das GzD konnte nicht angehängt werden (${error instanceof Error ? error.message : "unbekannter Fehler"}).`,
        );
      }
    } else warnings.push("Für das ausgewählte GzD ist keine Datei verfügbar.");
  }

  const password = await decryptEmailPassword(
    env,
    db,
    sender.password_ciphertext,
  );
  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      sendSmtpMessage(
        sender,
        password,
        recipient,
        subject,
        messageBody,
        attachments,
      ),
    ),
  );
  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;
  if (!sent) {
    const firstFailure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    return json(
      {
        error:
          firstFailure?.reason instanceof Error
            ? firstFailure.reason.message
            : "Die Angebotsmail konnte nicht versendet werden.",
      },
      { status: 502 },
    );
  }
  return json({
    ok: true,
    sent,
    failed,
    attachmentCount: attachments.length,
    warning: warnings.join(" "),
    message:
      failed > 0
        ? `${sent} Kundenmail(s) versendet, ${failed} fehlgeschlagen.`
        : `${sent} Kundenmail(s) erfolgreich versendet.`,
  });
}

async function sendOrderEmail(
  body: Record<string, unknown>,
  request: Request,
  url: URL,
  env: Env,
  db: D1Database,
) {
  if (!sameOriginRequest(request, url, env))
    return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });
  await ensureFullSchema(db);
  const offerId = Number(body.offerId);
  const orderNumber = safeMailHeader(String(body.orderNumber || ""));
  const quantity = Number(body.quantity);
  const rawItemQuantities =
    body.itemQuantities && typeof body.itemQuantities === "object"
      ? (body.itemQuantities as Record<string, unknown>)
      : undefined;
  if (
    !Number.isInteger(offerId) ||
    offerId <= 0 ||
    !/^BE-\d{4}-\d{3,}$/.test(orderNumber)
  )
    return json(
      { error: "Die Bestelldaten sind unvollständig." },
      { status: 400 },
    );
  const offerRow = await db
    .prepare(
      "SELECT d.id, d.project_id, d.payload, d.supplier_id, c.name AS customer_name, c.email AS customer_email, e.name AS employee_name, e.email AS employee_email, e.mail_to_main, s.email AS supplier_email FROM documents d JOIN customers c ON c.id = d.customer_id LEFT JOIN customer_employees e ON e.id = d.customer_employee_id LEFT JOIN suppliers s ON s.id = d.supplier_id WHERE d.id = ? AND d.type = 'Angebot' AND d.status = 'Offen' LIMIT 1",
    )
    .bind(offerId)
    .first<Record<string, string | number | null>>();
  if (!offerRow)
    return json(
      { error: "Das offene Angebot wurde nicht gefunden." },
      { status: 404 },
    );
  const offer = parseJson<StateDocument>(
    String(offerRow.payload || "{}"),
    {} as StateDocument,
  );
  const workflow = await db
    .prepare(
      "SELECT order_template, order_recipient FROM workflow_settings ORDER BY id LIMIT 1",
    )
    .first<Record<string, string | number | null>>();
  const sender = await db
    .prepare(
      "SELECT * FROM email_sender_profiles WHERE active = 1 ORDER BY is_default DESC, id LIMIT 1",
    )
    .first<EmailSenderRow>();
  if (!sender?.password_ciphertext)
    return json(
      { error: "Es ist kein aktiver SMTP-Absender eingerichtet." },
      { status: 400 },
    );
  const customerRecipients = Array.from(
    new Set(
      [
        String(offerRow.employee_email || "").trim().toLowerCase(),
        Number(offerRow.mail_to_main)
          ? String(offerRow.customer_email || "").trim().toLowerCase()
          : "",
      ].filter(validEmail),
    ),
  );
  const recipientKind = String(workflow?.order_recipient || "system");
  const recipients =
    recipientKind === "customer"
      ? customerRecipients
      : recipientKind === "supplier"
        ? [String(offerRow.supplier_email || "").trim().toLowerCase()].filter(
            validEmail,
          )
        : [String(sender.from_email || "").trim().toLowerCase()].filter(
            validEmail,
          );
  if (!recipients.length)
    return json(
      {
        error:
          "Für den gewählten Workflow-Empfänger ist keine gültige E-Mail-Adresse hinterlegt.",
      },
      { status: 400 },
    );
  let orderItems: StateDocumentItem[] | undefined;
  let selectedOption:
    | { quantity: number; unitPrice: number; supplierTotal?: number }
    | undefined;
  if (offer.items?.length) {
    if (!rawItemQuantities)
      return json(
        { error: "Die ausgewählten Artikelmengen fehlen." },
        { status: 400 },
      );
    if (
      offer.items.some((item) => {
        const selectedQuantity = Number(
          rawItemQuantities[String(item.articleId)],
        );
        return !item.offerOptions?.some(
          (offerOption) => offerOption.quantity === selectedQuantity,
        );
      })
    )
      return json(
        { error: "Mindestens eine gewählte Angebotsstaffel ist ungültig." },
        { status: 400 },
      );
    orderItems = offer.items.map((item) => {
      const selectedQuantity = Number(rawItemQuantities[String(item.articleId)]);
      const option = item.offerOptions!.find(
        (offerOption) => offerOption.quantity === selectedQuantity,
      )!;
      const subtotal = option.supplierTotal ?? option.quantity * option.unitPrice;
      return {
        ...item,
        quantity: option.quantity,
        unitPrice: option.unitPrice,
        subtotal,
        markupAmount: 0,
        total: subtotal,
        requestedQuantities: undefined,
        offerOptions: undefined,
      };
    });
    selectedOption = {
      quantity: orderItems[0].quantity,
      unitPrice: orderItems[0].unitPrice,
      supplierTotal: orderItems[0].subtotal,
    };
  } else {
    selectedOption = offer.offerOptions?.find(
      (option) => option.quantity === quantity,
    );
    if (!selectedOption)
      return json(
        { error: "Die gewählte Angebotsstaffel ist ungültig." },
        { status: 400 },
      );
  }
  const subtotal = orderItems?.length
    ? orderItems.reduce((sum, item) => sum + item.subtotal, 0)
    : selectedOption.supplierTotal ??
      selectedOption.quantity * selectedOption.unitPrice;
  const projectId = Number(offerRow.project_id || offer.projectId || offerId);
  const supplierReference = safeMailHeader(
    String(offer.supplierReference || ""),
  ).slice(0, 160);
  const values = {
    supplier: offer.supplier || "Lieferant",
    customer: String(offerRow.customer_name),
    article: orderItems?.length
      ? `Sammelbestellung mit ${orderItems.length} Artikeln`
      : offer.article,
    quantity: orderItems?.length
      ? `${orderItems.length} Artikel`
      : selectedOption.quantity,
    deliveryDate:
      offer.supplierDeliveryDate || offer.deliveryDate || "auf Anfrage",
    note: offer.supplierDeliveryNote || offer.supplierNote || "",
    project: projectId,
    total: subtotal.toFixed(2),
    orderNumber,
    supplierReference,
  };
  const orderText = renderEmailTemplate(
    String(workflow?.order_template || "").replaceAll("\\n", "\n"),
    values,
  );
  const orderDocumentText = [
    orderText,
    supplierReference ? `Lieferantenreferenz: ${supplierReference}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const pdfDataUri = await createDocumentPdfDataUri({
    number: orderNumber,
    type: "Bestellung",
    status: "Versendet",
    date: new Intl.DateTimeFormat("de-CH").format(new Date()),
    customer: String(offerRow.customer_name),
    employee: String(offerRow.employee_name || "Kundenportal"),
    supplier: offer.supplier,
    projectId,
    article: orderItems?.length
      ? `Sammelbestellung · ${orderItems.length} Artikel`
      : offer.article,
    quantity: selectedOption.quantity,
    unitPrice: selectedOption.unitPrice,
    subtotal,
    markupPercent: 0,
    markupAmount: 0,
    total: subtotal,
    supplierDeliveryDate: offer.supplierDeliveryDate,
    supplierDeliveryNote: offer.supplierDeliveryNote,
    note: offer.supplierNote,
    documentText: orderDocumentText,
    printFile: offer.printFile,
    supplierGzd: offer.supplierGzd,
    items: orderItems,
  });
  const messageBody = `${orderDocumentText}\n\nDie Bestellung wurde vom Kunden im Kundenportal ausgelöst.\nBestellnummer: ${orderNumber}\nProjekt: ${projectId}`;
  const password = await decryptEmailPassword(
    env,
    db,
    sender.password_ciphertext,
  );
  await Promise.all(
    recipients.map((recipient) =>
      sendSmtpMessage(
        sender,
        password,
        recipient,
        `Neue Kundenbestellung ${orderNumber} · ${String(offerRow.customer_name)}`,
        messageBody,
        [
          {
            filename: `${orderNumber}.pdf`,
            contentType: "application/pdf",
            contentBase64: pdfDataUri.slice(pdfDataUri.indexOf(",") + 1),
          },
        ],
      ),
    ),
  );
  return json({
    ok: true,
    message: `Der Bestellungsbeleg wurde an ${recipients.join(", ")} gesendet.`,
  });
}

async function readFullState(db: D1Database) {
  await ensureFullSchema(db);
  const directory = await readDirectory(db);
  const initialized = Boolean(
    await db
      .prepare("SELECT value FROM app_meta WHERE key = ?")
      .bind("full_state_seeded")
      .first(),
  );
  const [
    articleRows,
    stockRows,
    templateRows,
    documentRows,
    optionRows,
    backendRows,
    workflowRow,
  ] = await Promise.all([
    db
      .prepare(
        "SELECT a.id, a.sku, a.designation_1, a.designation_2, a.customer_id, a.supplier_id, a.supplier_group_id, a.stock, a.reorder_point, a.unit_price, s.name AS supplier_name, g.name AS group_name FROM articles a LEFT JOIN suppliers s ON s.id = a.supplier_id LEFT JOIN supplier_groups g ON g.id = a.supplier_group_id ORDER BY a.designation_1, a.designation_2",
      )
      .all<Record<string, string | number | null>>(),
    db
      .prepare(
        "SELECT id, article_id, occurred_at, change, stock_after, reason FROM stock_events ORDER BY occurred_at DESC, id DESC",
      )
      .all<Record<string, string | number>>(),
    db
      .prepare(
        "SELECT id, article_id, file_name, object_key, uploaded_at FROM gzd_templates ORDER BY uploaded_at DESC, id DESC",
      )
      .all<Record<string, string | number>>(),
    db
      .prepare("SELECT * FROM documents ORDER BY issued_at DESC, id DESC")
      .all<Record<string, string | number | null>>(),
    db
      .prepare(
        "SELECT document_id, quantity, supplier_unit_price, supplier_total FROM document_offer_options ORDER BY quantity",
      )
      .all<Record<string, number>>(),
    db
      .prepare(
        "SELECT id, name, email, role, password_hash, active FROM backend_users ORDER BY name",
      )
      .all<Record<string, string | number>>(),
    db
      .prepare("SELECT * FROM workflow_settings ORDER BY id LIMIT 1")
      .first<Record<string, string | number>>(),
  ]);
  const stockByArticle = new Map<
    number,
    Array<{ date: string; change: number; stock: number; reason: string }>
  >();
  for (const row of stockRows.results) {
    const articleId = Number(row.article_id);
    stockByArticle.set(articleId, [
      ...(stockByArticle.get(articleId) ?? []),
      {
        date: String(row.occurred_at),
        change: Number(row.change),
        stock: Number(row.stock_after),
        reason: String(row.reason),
      },
    ]);
  }
  const templatesByArticle = new Map<
    number,
    Array<{ id: number; file: string; addedAt: string; url?: string }>
  >();
  for (const row of templateRows.results) {
    const articleId = Number(row.article_id);
    const objectKey = String(row.object_key);
    templatesByArticle.set(articleId, [
      ...(templatesByArticle.get(articleId) ?? []),
      {
        id: Number(row.id),
        file: String(row.file_name),
        addedAt: String(row.uploaded_at),
        url: objectKey.startsWith("/api/files/") ? objectKey : undefined,
      },
    ]);
  }
  const optionsByDocument = new Map<
    number,
    Array<{ quantity: number; unitPrice: number; supplierTotal: number }>
  >();
  for (const row of optionRows.results) {
    const documentId = Number(row.document_id);
    optionsByDocument.set(documentId, [
      ...(optionsByDocument.get(documentId) ?? []),
      {
        quantity: Number(row.quantity),
        unitPrice: Number(row.supplier_unit_price),
        supplierTotal: Number(row.supplier_total),
      },
    ]);
  }
  const articles = articleRows.results.map((row) => ({
    id: Number(row.id),
    sku: String(row.sku),
    designation1: String(row.designation_1),
    designation2: String(row.designation_2),
    name: [String(row.designation_1), String(row.designation_2)]
      .filter(Boolean)
      .join(" · "),
    customerId: row.customer_id == null ? undefined : Number(row.customer_id),
    supplier: row.group_name
      ? `group:${row.group_name}`
      : row.supplier_name
        ? String(row.supplier_name)
        : "Nicht zugeordnet",
    stock: Number(row.stock),
    minimum: Number(row.reorder_point),
    unitPrice: Number(row.unit_price),
    stockHistory: stockByArticle.get(Number(row.id)) ?? [],
    templates: templatesByArticle.get(Number(row.id)) ?? [],
  }));
  const documents = documentRows.results.map((row) => {
    const payload = parseJson<StateDocument>(
      String(row.payload ?? "{}"),
      {} as StateDocument,
    );
    return {
      ...payload,
      id: Number(row.id),
      number: String(row.document_number),
      type: String(row.type),
      status: String(row.status),
      customerId:
        row.customer_id == null ? payload.customerId : Number(row.customer_id),
      employeeId:
        row.customer_employee_id == null
          ? undefined
          : Number(row.customer_employee_id),
      supplierId: row.supplier_id == null ? undefined : Number(row.supplier_id),
      projectId: row.project_id == null ? undefined : Number(row.project_id),
      subtotal: Number(row.subtotal),
      markupPercent: Number(row.markup_percent),
      markupAmount: Number(row.markup_amount),
      total: Number(row.total),
      date: String(row.issued_at),
      supplierToken:
        row.supplier_token == null ? undefined : String(row.supplier_token),
      deliveryDate:
        row.delivery_date == null ? undefined : String(row.delivery_date),
      supplierLeadTime:
        row.supplier_lead_time == null
          ? undefined
          : String(row.supplier_lead_time),
      supplierDeliveryDate:
        row.supplier_delivery_date == null
          ? undefined
          : String(row.supplier_delivery_date),
      supplierDeliveryNote:
        row.supplier_delivery_note == null
          ? undefined
          : String(row.supplier_delivery_note),
      supplierReference:
        row.supplier_reference == null
          ? payload.supplierReference
          : String(row.supplier_reference),
      bindingDeliveryConfirmationDue:
        row.binding_delivery_confirmation_due == null
          ? undefined
          : String(row.binding_delivery_confirmation_due),
      requestedQuantities: parseJson<number[]>(
        String(row.requested_quantities_json ?? "[]"),
        payload.requestedQuantities ?? [],
      ),
      note: row.note == null ? undefined : String(row.note),
      requestText:
        row.request_text == null ? undefined : String(row.request_text),
      documentText:
        row.document_text == null ? undefined : String(row.document_text),
      supplierNote:
        row.supplier_note == null ? undefined : String(row.supplier_note),
      attachDocument: Boolean(row.attach_document),
      attachGzd: Boolean(row.attach_gzd),
      printFile:
        row.print_file_key == null ? undefined : String(row.print_file_key),
      supplierGzd:
        row.supplier_gzd_key == null ? undefined : String(row.supplier_gzd_key),
      gzdStatus: row.gzd_status == null ? undefined : String(row.gzd_status),
      offerOptions:
        optionsByDocument.get(Number(row.id)) ?? payload.offerOptions,
    } as StateDocument;
  });
  const workflowSettings = workflowRow
    ? {
        requestTemplate: String(workflowRow.request_template),
        offerTemplate: String(workflowRow.offer_template),
        orderTemplate: String(workflowRow.order_template),
        confirmationTemplate: String(workflowRow.confirmation_template),
        reorderPointSubject: String(
          workflowRow.reorder_point_subject ??
            "Meldebestand erreicht: {sku} · {article}",
        ),
        reorderPointTemplate: String(
          workflowRow.reorder_point_template ??
            "Guten Tag {customer},\\n\\nder Meldebestand für den Artikel {sku} · {article} wurde erreicht.\\n\\nAktueller Bestand: {stock} Stück\\nMeldebestand: {minimum} Stück\\n\\nBitte prüfen Sie eine Nachbestellung.\\n\\nFreundliche Grüsse\\nPrintcenter",
        ).replaceAll("\\n", "\n"),
        requestRecipient: String(workflowRow.request_recipient ?? "supplier"),
        offerRecipient: String(workflowRow.offer_recipient ?? "customer"),
        orderRecipient: String(workflowRow.order_recipient ?? "system"),
        confirmationRecipient: String(
          workflowRow.confirmation_recipient ?? "customer",
        ),
        reorderPointRecipient: String(
          workflowRow.reorder_point_recipient ?? "customer",
        ),
        employeeLoginSubject: String(
          workflowRow.employee_login_subject ??
            "Ihr Zugang zum Printcenter von {company}",
        ),
        employeeLoginTemplate: String(
          workflowRow.employee_login_template ??
            "Guten Tag {salutation} {lastName},\\n\\nIhr persönlicher Zugang zum Kundenportal von {company} ist eingerichtet.\\n\\nPortal: {portalUrl}\\nLogin: {email}\\nPasswort: {password}\\n\\nBitte bewahren Sie diese Zugangsdaten sicher auf.\\n\\nFreundliche Grüsse\\nPrintcenter",
        ).replaceAll("\\n", "\n"),
        customerPasswordResetSubject: String(
          workflowRow.customer_password_reset_subject ??
            "Passwort für Ihr Printcenter-Kundenportal zurücksetzen",
        ),
        customerPasswordResetTemplate: String(
          workflowRow.customer_password_reset_template ??
            "Guten Tag {salutation} {lastName},\\n\\nüber den folgenden Link können Sie Ihr Passwort für das Kundenportal von {company} neu setzen:\\n\\n{resetUrl}\\n\\nDer Link ist {expiresIn} gültig und kann nur einmal verwendet werden. Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.\\n\\nFreundliche Grüsse\\nPrintcenter",
        ).replaceAll("\\n", "\n"),
        backendPasswordResetSubject: String(
          workflowRow.backend_password_reset_subject ??
            "Passwort für Printcenter zurücksetzen",
        ),
        backendPasswordResetTemplate: String(
          workflowRow.backend_password_reset_template ??
            "Guten Tag {name},\\n\\nüber den folgenden Link können Sie Ihr Passwort für das Printcenter-Backend neu setzen:\\n\\n{resetUrl}\\n\\nDer Link ist {expiresIn} gültig und kann nur einmal verwendet werden. Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.\\n\\nFreundliche Grüsse\\nPrintcenter",
        ).replaceAll("\\n", "\n"),
        supplierOfferSubject: String(workflowRow.supplier_offer_subject),
        offerEmail: String(workflowRow.offer_email),
        orderEmail: String(workflowRow.order_email),
        attachRequestDocument: Boolean(workflowRow.attach_request_document),
        attachRequestGzd: Boolean(workflowRow.attach_request_gzd),
        attachOfferDocument: Boolean(workflowRow.attach_offer_document),
        attachOfferGzd: Boolean(workflowRow.attach_offer_gzd),
        attachOrderDocument: Boolean(workflowRow.attach_order_document),
        attachOrderGzd: Boolean(workflowRow.attach_order_gzd),
        attachConfirmationDocument: Boolean(
          workflowRow.attach_confirmation_document,
        ),
        attachConfirmationGzd: Boolean(workflowRow.attach_confirmation_gzd),
      }
    : undefined;
  return {
    initialized,
    ...directory,
    articles,
    documents,
    backendUsers: backendRows.results.map((row) => ({
      id: Number(row.id),
      name: String(row.name),
      email: String(row.email),
      role: String(row.role),
      password: String(row.password_hash),
      active: Boolean(row.active),
    })),
    workflowSettings,
  };
}

async function replaceFullState(db: D1Database, state: FullState) {
  await ensureFullSchema(db);
  const articleColumns = await db
    .prepare("PRAGMA table_info(articles)")
    .all<{ name: string }>();
  const hasLegacyArticleName = articleColumns.results.some(
    (column) => column.name === "name",
  );
  const statements: D1PreparedStatement[] = [];
  for (const table of [
    "document_attachments",
    "document_offer_options",
    "document_lines",
    "documents",
    "projects",
    "gzd_templates",
    "stock_events",
    "articles",
    "customer_accounts",
    "customer_employees",
    "suppliers",
    "supplier_groups",
    "customers",
    "backend_users",
    "workflow_settings",
  ])
    statements.push(db.prepare(`DELETE FROM ${table}`));
  const groupIds = new Map(
    state.groups.map((name, index) => [name, index + 1]),
  );
  for (const [name, id] of groupIds)
    statements.push(
      db
        .prepare("INSERT INTO supplier_groups (id, name) VALUES (?, ?)")
        .bind(id, name),
    );
  for (const customer of state.customers) {
    statements.push(
      db
        .prepare(
          "INSERT INTO customers (id, customer_number, name, contact_salutation, contact_first_name, contact_last_name, email, phone, street, postal_code, city, country, markup_percent, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          customer.id,
          customer.number,
          customer.name,
          customer.contactSalutation ?? "Divers",
          customer.contactFirstName ?? "",
          customer.contactLastName ?? "",
          customer.email,
          customer.phone,
          customer.street,
          customer.postalCode,
          customer.city,
          customer.country,
          customer.markup,
          customer.status === "Aktiv" ? "active" : "draft",
        ),
    );
    for (const employee of customer.employees)
      statements.push(
        db
          .prepare(
            "INSERT INTO customer_employees (id, customer_id, name, salutation, first_name, last_name, email, phone, login, password_hash, mail_to_main, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
          )
          .bind(
            employee.id,
            customer.id,
            employee.name,
            employee.salutation ?? "Divers",
            employee.firstName ?? employee.name.split(" ")[0] ?? "",
            employee.lastName ?? employee.name.split(" ").slice(1).join(" "),
            employee.email,
            employee.phone,
            employee.email,
            employee.password ?? "portal",
            employee.mailToMain ? 1 : 0,
          ),
      );
  }
  for (const supplier of state.suppliers) {
    statements.push(
      db
        .prepare(
          "INSERT INTO suppliers (id, supplier_number, name, contact_name, email, phone, group_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          supplier.id,
          supplier.number,
          supplier.name,
          supplier.contact,
          supplier.email,
          supplier.phone,
          groupIds.get(supplier.group) ?? null,
        ),
    );
  }
  const suppliersByName = new Map(
    state.suppliers.map((supplier) => [supplier.name, supplier.id]),
  );
  const validSupplierIds = new Set(
    state.suppliers.map((supplier) => supplier.id),
  );
  const validArticleIds = new Set(state.articles.map((article) => article.id));
  const validEmployeeIds = new Set(
    state.customers.flatMap((customer) =>
      customer.employees.map((employee) => employee.id),
    ),
  );
  for (const article of state.articles) {
    const groupName = article.supplier.startsWith("group:")
      ? article.supplier.slice(6)
      : undefined;
    const supplierId = groupName
      ? null
      : (suppliersByName.get(article.supplier) ?? null);
    const articleValues = [
          article.id,
          article.sku,
          ...(hasLegacyArticleName ? [article.name] : []),
          article.designation1 || article.name,
          article.designation2 || "",
          article.customerId &&
            state.customers.some(
              (customer) => customer.id === article.customerId,
            )
            ? article.customerId
            : null,
          supplierId,
          groupName ? (groupIds.get(groupName) ?? null) : null,
          article.stock,
          article.minimum,
          article.unitPrice,
          JSON.stringify(article.stockHistory),
        ];
    statements.push(
      db
        .prepare(
          hasLegacyArticleName
            ? "INSERT INTO articles (id, sku, name, designation_1, designation_2, customer_id, supplier_id, supplier_group_id, stock, reorder_point, unit_price, stock_history_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            : "INSERT INTO articles (id, sku, designation_1, designation_2, customer_id, supplier_id, supplier_group_id, stock, reorder_point, unit_price, stock_history_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(...articleValues),
    );
    article.stockHistory.forEach((event, index) =>
      statements.push(
        db
          .prepare(
            "INSERT INTO stock_events (id, article_id, occurred_at, change, stock_after, reason) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(
            article.id * 1000 + index + 1,
            article.id,
            event.date,
            event.change,
            event.stock,
            event.reason,
          ),
      ),
    );
    for (const template of article.templates)
      statements.push(
        db
          .prepare(
            "INSERT INTO gzd_templates (id, article_id, file_name, object_key, uploaded_at) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(
            template.id,
            article.id,
            template.file,
            template.url ?? `gzd/${article.id}/${template.id}-${template.file}`,
            template.addedAt,
          ),
      );
  }
  const projectDocuments = new Map<number, StateDocument[]>();
  for (const document of state.documents) {
    const projectId = document.projectId ?? document.id;
    projectDocuments.set(projectId, [
      ...(projectDocuments.get(projectId) ?? []),
      document,
    ]);
  }
  for (const [projectId, projectDocs] of projectDocuments) {
    const first = projectDocs[0];
    const status = projectDocs.some(
      (item) => item.type === "Auftragsbestätigung",
    )
      ? "confirmed"
      : projectDocs.some((item) => item.type === "Bestellung")
        ? "ordered"
        : projectDocs.some((item) => item.type === "Angebot")
          ? "quoted"
          : "requested";
    const groupName = first.supplier?.startsWith("Lieferantengruppe · ")
      ? first.supplier.slice("Lieferantengruppe · ".length)
      : undefined;
    const candidateSupplierId =
      first.supplierId ??
      (first.supplier ? suppliersByName.get(first.supplier) : undefined);
    statements.push(
      db
        .prepare(
          "INSERT INTO projects (id, title, status, customer_id, customer_employee_id, article_id, supplier_id, supplier_group_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          projectId,
          first.article || first.number,
          status,
          state.customers.some((item) => item.id === first.customerId)
            ? first.customerId
            : null,
          first.employeeId && validEmployeeIds.has(first.employeeId)
            ? first.employeeId
            : null,
          first.articleId && validArticleIds.has(first.articleId)
            ? first.articleId
            : null,
          candidateSupplierId && validSupplierIds.has(candidateSupplierId)
            ? candidateSupplierId
            : null,
          groupName ? (groupIds.get(groupName) ?? null) : null,
          first.date,
          first.date,
        ),
    );
  }
  for (const document of state.documents) {
    const payload = JSON.stringify(document, (key, value) =>
      key === "pdfUrl" ? undefined : value,
    );
    const projectId = document.projectId ?? document.id;
    const candidateSupplierId =
      document.supplierId ??
      (document.supplier ? suppliersByName.get(document.supplier) : undefined);
    statements.push(
      db
        .prepare(
          "INSERT INTO documents (id, document_number, type, status, customer_id, customer_employee_id, supplier_id, subtotal, markup_percent, markup_amount, total, issued_at, project_id, supplier_token, delivery_date, supplier_lead_time, supplier_delivery_date, supplier_delivery_note, supplier_reference, binding_delivery_confirmation_due, requested_quantities_json, note, request_text, document_text, supplier_note, attach_document, attach_gzd, print_file_key, supplier_gzd_key, gzd_status, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          document.id,
          document.number,
          document.type,
          document.status,
          state.customers.some((item) => item.id === document.customerId)
            ? document.customerId
            : null,
          document.employeeId && validEmployeeIds.has(document.employeeId)
            ? document.employeeId
            : null,
          candidateSupplierId && validSupplierIds.has(candidateSupplierId)
            ? candidateSupplierId
            : null,
          document.subtotal,
          document.markupPercent,
          document.markupAmount,
          document.total,
          document.date,
          projectId,
          document.supplierToken ?? null,
          document.deliveryDate ?? null,
          document.supplierLeadTime ?? null,
          document.supplierDeliveryDate ?? null,
          document.supplierDeliveryNote ?? null,
          document.supplierReference ?? null,
          document.bindingDeliveryConfirmationDue ?? null,
          JSON.stringify(document.requestedQuantities ?? []),
          document.note ?? null,
          document.requestText ?? null,
          document.documentText ?? null,
          document.supplierNote ?? null,
          document.attachDocument === false ? 0 : 1,
          document.attachGzd === false ? 0 : 1,
          document.printFile ?? null,
          document.supplierGzd ?? null,
          document.gzdStatus ?? null,
          payload,
        ),
    );
    const documentItems = document.items?.length
      ? document.items
      : [
          {
            articleId: document.articleId ?? 0,
            sku: "",
            article: document.article,
            quantity: document.quantity,
            unitPrice: document.unitPrice,
            total: document.total,
          },
        ];
    for (const item of documentItems)
      statements.push(
        db
          .prepare(
            "INSERT INTO document_lines (document_id, article_id, title, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(
            document.id,
            item.articleId && validArticleIds.has(item.articleId)
              ? item.articleId
              : null,
            item.article,
            item.quantity,
            item.unitPrice,
            item.total,
          ),
      );
    if (!document.items?.length)
      for (const option of document.offerOptions ?? [])
        statements.push(
          db
            .prepare(
              "INSERT INTO document_offer_options (document_id, quantity, supplier_unit_price, supplier_total) VALUES (?, ?, ?, ?)",
            )
            .bind(
              document.id,
              option.quantity,
              option.unitPrice,
              option.supplierTotal ?? option.quantity * option.unitPrice,
            ),
        );
    if (document.printFile)
      statements.push(
        db
          .prepare(
            "INSERT INTO document_attachments (document_id, kind, file_name, object_key) VALUES (?, ?, ?, ?)",
          )
          .bind(
            document.id,
            "customer_gzd",
            document.printFile,
            `documents/${document.id}/customer-${document.printFile}`,
          ),
      );
    if (document.supplierGzd)
      statements.push(
        db
          .prepare(
            "INSERT INTO document_attachments (document_id, kind, file_name, object_key) VALUES (?, ?, ?, ?)",
          )
          .bind(
            document.id,
            "supplier_gzd",
            document.supplierGzd,
            `documents/${document.id}/supplier-${document.supplierGzd}`,
          ),
      );
    for (const item of document.items ?? []) {
      if (item.printFile)
        statements.push(
          db
            .prepare(
              "INSERT INTO document_attachments (document_id, kind, file_name, object_key) VALUES (?, ?, ?, ?)",
            )
            .bind(
              document.id,
              "customer_gzd",
              item.printFile,
              `documents/${document.id}/article-${item.articleId}-customer-${item.printFile}`,
            ),
        );
      if (item.supplierGzd)
        statements.push(
          db
            .prepare(
              "INSERT INTO document_attachments (document_id, kind, file_name, object_key) VALUES (?, ?, ?, ?)",
            )
            .bind(
              document.id,
              "supplier_gzd",
              item.supplierGzd,
              `documents/${document.id}/article-${item.articleId}-supplier-${item.supplierGzd}`,
            ),
        );
    }
  }
  for (const user of state.backendUsers)
    statements.push(
      db
        .prepare(
          "INSERT INTO backend_users (id, name, email, role, password_hash, active) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          user.id,
          user.name,
          user.email,
          user.role,
          user.password,
          user.active ? 1 : 0,
        ),
    );
  const workflow = state.workflowSettings;
  statements.push(
    db
      .prepare(
        "INSERT INTO workflow_settings (id, request_template, offer_template, order_template, confirmation_template, reorder_point_subject, reorder_point_template, request_recipient, offer_recipient, order_recipient, confirmation_recipient, reorder_point_recipient, employee_login_subject, employee_login_template, customer_password_reset_subject, customer_password_reset_template, backend_password_reset_subject, backend_password_reset_template, supplier_offer_subject, offer_email, order_email, attach_request_document, attach_request_gzd, attach_offer_document, attach_offer_gzd, attach_order_document, attach_order_gzd, attach_confirmation_document, attach_confirmation_gzd, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
      )
      .bind(
        workflow.requestTemplate,
        workflow.offerTemplate,
        workflow.orderTemplate,
        workflow.confirmationTemplate,
        workflow.reorderPointSubject ||
          "Meldebestand erreicht: {sku} · {article}",
        workflow.reorderPointTemplate ||
          "Guten Tag {customer},\n\nder Meldebestand für den Artikel {sku} · {article} wurde erreicht.\n\nAktueller Bestand: {stock} Stück\nMeldebestand: {minimum} Stück\n\nBitte prüfen Sie eine Nachbestellung.\n\nFreundliche Grüsse\nPrintcenter",
        workflow.requestRecipient || "supplier",
        workflow.offerRecipient || "customer",
        workflow.orderRecipient || "system",
        workflow.confirmationRecipient || "customer",
        workflow.reorderPointRecipient || "customer",
        workflow.employeeLoginSubject ||
          "Ihr Zugang zum Printcenter von {company}",
        workflow.employeeLoginTemplate ||
          "Guten Tag {salutation} {lastName},\n\nIhr persönlicher Zugang zum Kundenportal von {company} ist eingerichtet.\n\nPortal: {portalUrl}\nLogin: {email}\nPasswort: {password}\n\nBitte bewahren Sie diese Zugangsdaten sicher auf.\n\nFreundliche Grüsse\nPrintcenter",
        workflow.customerPasswordResetSubject ||
          "Passwort für Ihr Printcenter-Kundenportal zurücksetzen",
        workflow.customerPasswordResetTemplate ||
          "Guten Tag {salutation} {lastName},\n\nüber den folgenden Link können Sie Ihr Passwort für das Kundenportal von {company} neu setzen:\n\n{resetUrl}\n\nDer Link ist {expiresIn} gültig und kann nur einmal verwendet werden. Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.\n\nFreundliche Grüsse\nPrintcenter",
        workflow.backendPasswordResetSubject ||
          "Passwort für Printcenter zurücksetzen",
        workflow.backendPasswordResetTemplate ||
          "Guten Tag {name},\n\nüber den folgenden Link können Sie Ihr Passwort für das Printcenter-Backend neu setzen:\n\n{resetUrl}\n\nDer Link ist {expiresIn} gültig und kann nur einmal verwendet werden. Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.\n\nFreundliche Grüsse\nPrintcenter",
        workflow.supplierOfferSubject,
        workflow.offerEmail,
        workflow.orderEmail,
        workflow.attachRequestDocument ? 1 : 0,
        workflow.attachRequestGzd ? 1 : 0,
        workflow.attachOfferDocument ? 1 : 0,
        workflow.attachOfferGzd ? 1 : 0,
        workflow.attachOrderDocument ? 1 : 0,
        workflow.attachOrderGzd ? 1 : 0,
        workflow.attachConfirmationDocument ? 1 : 0,
        workflow.attachConfirmationGzd ? 1 : 0,
      ),
  );
  statements.push(
    db.prepare(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('full_state_seeded', '1')",
    ),
  );
  await db.batch(statements);
  await db.prepare("PRAGMA optimize").run();
}

async function databaseHealth(db: D1Database) {
  await ensureFullSchema(db);
  const expectedTables = [
    "customers",
    "customer_employees",
    "supplier_groups",
    "suppliers",
    "articles",
    "gzd_templates",
    "stock_events",
    "projects",
    "documents",
    "document_lines",
    "document_offer_options",
    "document_attachments",
    "backend_users",
    "workflow_settings",
    "integration_settings",
    "email_sender_profiles",
    "navision_sync_log",
  ];
  const tableRows = await db
    .prepare("SELECT name FROM sqlite_schema WHERE type = 'table'")
    .all<{ name: string }>();
  const existing = new Set(tableRows.results.map((row) => row.name));
  const counts: Record<string, number> = {};
  for (const table of expectedTables)
    counts[table] = Number(
      (
        await db
          .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
          .first<{ count: number }>()
      )?.count ?? 0,
    );
  const foreignKeyViolations = await db
    .prepare("PRAGMA foreign_key_check")
    .all<Record<string, string | number>>();
  const brokenDocumentProjects = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM documents d LEFT JOIN projects p ON p.id = d.project_id WHERE d.project_id IS NOT NULL AND p.id IS NULL",
    )
    .first<{ count: number }>();
  const brokenDocumentLines = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM document_lines l LEFT JOIN documents d ON d.id = l.document_id WHERE d.id IS NULL",
    )
    .first<{ count: number }>();
  const brokenOfferOptions = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM document_offer_options o LEFT JOIN documents d ON d.id = o.document_id WHERE d.id IS NULL",
    )
    .first<{ count: number }>();
  return {
    ok:
      expectedTables.every((table) => existing.has(table)) &&
      foreignKeyViolations.results.length === 0 &&
      !brokenDocumentProjects?.count &&
      !brokenDocumentLines?.count &&
      !brokenOfferOptions?.count,
    missingTables: expectedTables.filter((table) => !existing.has(table)),
    foreignKeyViolations: foreignKeyViolations.results,
    brokenLinks: {
      documentProjects: Number(brokenDocumentProjects?.count ?? 0),
      documentLines: Number(brokenDocumentLines?.count ?? 0),
      offerOptions: Number(brokenOfferOptions?.count ?? 0),
    },
    counts,
  };
}

async function readIntegrationSettings(db: D1Database) {
  await ensureFullSchema(db);
  const row = await db
    .prepare("SELECT * FROM integration_settings WHERE id = 1")
    .first<Record<string, string | number>>();
  return {
    navisionEndpoint: String(row?.navision_endpoint ?? ""),
    navisionTenant: String(row?.navision_tenant ?? ""),
    apiBaseUrl: String(row?.api_base_url ?? ""),
    apiClientId: String(row?.api_client_id ?? ""),
    ftpProtocol: String(row?.ftp_protocol ?? "SFTP"),
    ftpHost: String(row?.ftp_host ?? ""),
    ftpPort: String(row?.ftp_port ?? "22"),
    ftpUsername: String(row?.ftp_username ?? ""),
    ftpDirectory: String(row?.ftp_directory ?? "/printcenter"),
    sftpPullIntervalMinutes: Number(row?.sftp_pull_interval_minutes ?? 60),
    sftpCsvEntity: String(row?.sftp_csv_entity ?? "articles"),
    sftpCsvDelimiter: String(row?.sftp_csv_delimiter ?? ";"),
    sftpCsvHasHeader: Boolean(row?.sftp_csv_has_header ?? 1),
    sftpCsvFilePattern: String(row?.sftp_csv_file_pattern ?? "*.csv"),
    sftpCsvMappings: parseJson<
      Array<{ csvColumn: string; targetField: string }>
    >(String(row?.sftp_csv_mapping_json ?? "[]"), []),
  };
}

async function purgeStoredFiles(bucket: R2Bucket) {
  let cursor: string | undefined;
  let deletedFiles = 0;
  do {
    const page = await bucket.list({ cursor });
    const keys = page.objects.map((object) => object.key);
    if (keys.length) {
      await bucket.delete(keys);
      deletedFiles += keys.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deletedFiles;
}

async function purgeBusinessData(db: D1Database) {
  await ensureFullSchema(db);
  await db.batch([
    db.prepare("DELETE FROM document_attachments"),
    db.prepare("DELETE FROM document_offer_options"),
    db.prepare("DELETE FROM document_lines"),
    db.prepare("DELETE FROM documents"),
    db.prepare("DELETE FROM projects"),
    db.prepare("DELETE FROM gzd_templates"),
    db.prepare("DELETE FROM stock_events"),
    db.prepare("DELETE FROM articles"),
    db.prepare("DELETE FROM customer_accounts"),
    db.prepare("DELETE FROM customer_employees"),
    db.prepare("DELETE FROM suppliers"),
    db.prepare("DELETE FROM supplier_groups"),
    db.prepare("DELETE FROM customers"),
    db.prepare("DELETE FROM navision_sync_log"),
    db.prepare("DELETE FROM app_meta WHERE key LIKE 'portal_preview:%'"),
    db.prepare(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('full_state_seeded', '1')",
    ),
  ]);
  await db.prepare("PRAGMA optimize").run();
}

async function handleDirectoryApi(
  request: Request,
  env: Env,
  db: D1Database,
  url: URL,
) {
  await ensureDirectorySchema(db);
  const customerMatch = url.pathname.match(/^\/api\/customers\/(\d+)$/);
  const employeeMatch = url.pathname.match(
    /^\/api\/customers\/(\d+)\/employees(?:\/(\d+))?$/,
  );
  const employeeLoginMailMatch = url.pathname.match(
    /^\/api\/customers\/(\d+)\/employees\/(\d+)\/send-login$/,
  );
  const supplierMatch = url.pathname.match(/^\/api\/suppliers\/(\d+)$/);
  const emailSenderMatch = url.pathname.match(
    /^\/api\/email-senders\/(\d+)(?:\/(test))?$/,
  );
  const portalPreviewMatch = url.pathname.match(
    /^\/api\/portal-previews\/([0-9a-f-]{36})$/i,
  );
  const backendPasswordResetMatch = url.pathname.match(
    /^\/api\/backend-password-resets\/([0-9a-f-]{36})$/i,
  );
  const customerPasswordResetMatch = url.pathname.match(
    /^\/api\/customer-password-resets\/([0-9a-f-]{36})$/i,
  );
  if (url.pathname === "/api/database/health" && request.method === "GET")
    return json(await databaseHealth(db));
  if (url.pathname === "/api/integrations" && request.method === "GET")
    return json(await readIntegrationSettings(db));
  if (url.pathname === "/api/email-senders" && request.method === "GET")
    return json({
      senders: await readEmailSenders(db),
      productionSecretConfigured: Boolean(env.EMAIL_ENCRYPTION_KEY?.trim()),
    });
  if (url.pathname === "/api/state" && request.method === "GET")
    return json(await readFullState(db));
  if (url.pathname === "/api/state" && request.method === "PUT") {
    const state = await request.json<FullState>();
    await replaceFullState(db, state);
    return json({ ok: true });
  }
  if (request.method === "GET" && url.pathname === "/api/directory")
    return json(await readDirectory(db));
  const body =
    request.method === "GET" ||
    (request.method === "DELETE" && url.pathname !== "/api/system-data") ||
    Boolean(portalPreviewMatch)
      ? {}
      : await request.json<Record<string, unknown>>();

  if (url.pathname === "/api/system-data" && request.method === "DELETE") {
    if (!sameOriginRequest(request, url, env))
      return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });
    if (String(body.confirmation || "") !== "ALLE DATEN LÖSCHEN")
      return json(
        { error: "Die Sicherheitsbestätigung ist nicht korrekt." },
        { status: 400 },
      );
    await purgeBusinessData(db);
    let deletedFiles = 0;
    let fileCleanupWarning: string | undefined;
    try {
      deletedFiles = await purgeStoredFiles(env.FILES);
    } catch (error) {
      fileCleanupWarning =
        error instanceof Error
          ? error.message
          : "Gespeicherte Dateien konnten nicht vollständig entfernt werden.";
    }
    return json({ ok: true, deletedFiles, fileCleanupWarning });
  }

  if (url.pathname === "/api/stock-snapshots" && request.method === "POST") {
    if (!sameOriginRequest(request, url, env))
      return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });
    const snapshots = Array.isArray(body.snapshots)
      ? body.snapshots.slice(0, 5000)
      : [];
    if (!snapshots.length)
      return json(
        { error: "Es wurden keine Bestandswerte übermittelt." },
        { status: 400 },
      );
    const statements: D1PreparedStatement[] = [];
    const missingSkus: string[] = [];
    const reorderPointAlerts: Array<{
      articleId: number;
      sku: string;
      previousStock: number;
      stock: number;
      minimum: number;
      change: number;
    }> = [];
    let updated = 0;
    let unchanged = 0;
    for (const rawSnapshot of snapshots) {
      const snapshot = rawSnapshot as Record<string, unknown>;
      const sku = String(snapshot.sku || "").trim().slice(0, 120);
      const stock = Number(snapshot.stock);
      if (!sku || !Number.isFinite(stock) || !Number.isInteger(stock)) continue;
      const article = await db
        .prepare(
          "SELECT id, stock, reorder_point FROM articles WHERE sku = ? LIMIT 1",
        )
        .bind(sku)
        .first<{ id: number; stock: number; reorder_point: number }>();
      if (!article) {
        missingSkus.push(sku);
        continue;
      }
      const previousStock = Number(article.stock);
      if (previousStock === stock) {
        unchanged += 1;
        continue;
      }
      const occurredAtValue = String(snapshot.occurredAt || "").trim();
      const occurredAt = Number.isFinite(Date.parse(occurredAtValue))
        ? new Date(occurredAtValue).toISOString()
        : new Date().toISOString();
      const change = stock - previousStock;
      statements.push(
        db.prepare("UPDATE articles SET stock = ? WHERE id = ?").bind(
          stock,
          article.id,
        ),
        db
          .prepare(
            "INSERT INTO stock_events (article_id, occurred_at, change, stock_after, reason) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(
            article.id,
            occurredAt,
            change,
            stock,
            String(snapshot.reason || "Bestandsimport über SFTP").slice(0, 240),
          ),
      );
      if (previousStock > article.reorder_point && stock <= article.reorder_point) {
        reorderPointAlerts.push({
          articleId: article.id,
          sku,
          previousStock,
          stock,
          minimum: article.reorder_point,
          change,
        });
        statements.push(
          db
            .prepare(
              "INSERT INTO navision_sync_log (entity_type, entity_id, direction, status, external_reference) VALUES ('reorder_point_alert', ?, 'outbound', 'pending', ?)",
            )
            .bind(article.id, sku),
        );
      }
      updated += 1;
    }
    if (statements.length) await db.batch(statements);
    return json({
      ok: true,
      updated,
      unchanged,
      missingSkus,
      reorderPointAlerts,
      notificationWorkflowReady: true,
    });
  }

  if (
    url.pathname === "/api/customer-password-resets" &&
    request.method === "POST"
  ) {
    if (!sameOriginRequest(request, url, env))
      return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });
    const customerId = Number(body.customerId);
    const employeeId = Number(body.employeeId);
    if (
      !Number.isInteger(customerId) ||
      customerId <= 0 ||
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    )
      return json(
        { error: "Der Mitarbeiterzugang ist ungültig." },
        { status: 400 },
      );
    const employee = await db
      .prepare(
        "SELECT e.id, e.name, e.salutation, e.first_name, e.last_name, e.email, c.name AS company FROM customer_employees e JOIN customers c ON c.id = e.customer_id WHERE e.id = ? AND e.customer_id = ? AND e.active = 1 LIMIT 1",
      )
      .bind(employeeId, customerId)
      .first<Record<string, string | number | null>>();
    if (!employee)
      return json(
        { error: "Der aktive Mitarbeiterzugang wurde nicht gefunden." },
        { status: 404 },
      );
    const sender = await db
      .prepare(
        "SELECT * FROM email_sender_profiles WHERE active = 1 ORDER BY is_default DESC, id LIMIT 1",
      )
      .first<EmailSenderRow>();
    if (!sender?.password_ciphertext)
      return json(
        {
          error:
            "Bitte zuerst unter E-Mail-Einstellungen einen aktiven SMTP-Absender einrichten.",
        },
        { status: 400 },
      );
    const workflow = await db
      .prepare(
        "SELECT customer_password_reset_subject, customer_password_reset_template FROM workflow_settings ORDER BY id LIMIT 1",
      )
      .first<Record<string, string | null>>();
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 30 * 60_000;
    const resetUrl = `${publicAppOrigin(env, url)}/passwort-zuruecksetzen/${token}`;
    const salutation =
      employee.salutation && employee.salutation !== "Divers"
        ? String(employee.salutation)
        : "";
    const values = {
      company: String(employee.company),
      salutation,
      firstName: String(employee.first_name ?? ""),
      lastName: String(employee.last_name ?? ""),
      employee: String(employee.name),
      email: String(employee.email),
      resetUrl,
      expiresIn: "30 Minuten",
    };
    const subject = renderEmailTemplate(
      String(
        workflow?.customer_password_reset_subject ??
          "Passwort für Ihr Printcenter-Kundenportal zurücksetzen",
      ),
      values,
    ).replace(/[\r\n]+/g, " ");
    const messageBody = renderEmailTemplate(
      String(
        workflow?.customer_password_reset_template ??
          "Guten Tag {salutation} {lastName},\\n\\nüber den folgenden Link können Sie Ihr Passwort für das Kundenportal von {company} neu setzen:\\n\\n{resetUrl}\\n\\nDer Link ist {expiresIn} gültig und kann nur einmal verwendet werden. Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.\\n\\nFreundliche Grüsse\\nPrintcenter",
      ).replaceAll("\\n", "\n"),
      values,
    );
    await db
      .prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)")
      .bind(
        `customer_password_reset:${token}`,
        JSON.stringify({ customerId, employeeId, expiresAt }),
      )
      .run();
    try {
      await sendSmtpMessage(
        sender,
        await decryptEmailPassword(env, db, sender.password_ciphertext),
        String(employee.email),
        subject,
        messageBody,
      );
      return json({ ok: true });
    } catch (error) {
      await db
        .prepare("DELETE FROM app_meta WHERE key = ?")
        .bind(`customer_password_reset:${token}`)
        .run();
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Der Reset-Link konnte nicht versendet werden.",
        },
        { status: 400 },
      );
    }
  }

  if (customerPasswordResetMatch && request.method === "POST") {
    if (!sameOriginRequest(request, url, env))
      return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });
    const password = String(body.password || "");
    if (password.length < 8)
      return json(
        { error: "Das Passwort muss mindestens 8 Zeichen haben." },
        { status: 400 },
      );
    const token = customerPasswordResetMatch[1].toLowerCase();
    const key = `customer_password_reset:${token}`;
    const stored = await db
      .prepare("SELECT value FROM app_meta WHERE key = ? LIMIT 1")
      .bind(key)
      .first<{ value: string }>();
    if (!stored?.value)
      return json(
        { error: "Dieser Reset-Link ist ungültig oder wurde bereits verwendet." },
        { status: 404 },
      );
    const reset = parseJson<{
      customerId: number;
      employeeId: number;
      expiresAt: number;
    }>(stored.value, { customerId: 0, employeeId: 0, expiresAt: 0 });
    if (reset.expiresAt < Date.now()) {
      await db.prepare("DELETE FROM app_meta WHERE key = ?").bind(key).run();
      return json(
        { error: "Dieser Reset-Link ist abgelaufen. Bitte fordern Sie einen neuen an." },
        { status: 410 },
      );
    }
    const result = await db
      .prepare(
        "UPDATE customer_employees SET password_hash = ? WHERE id = ? AND customer_id = ? AND active = 1",
      )
      .bind(password, reset.employeeId, reset.customerId)
      .run();
    if (!result.meta.changes)
      return json(
        { error: "Der Mitarbeiterzugang wurde nicht gefunden." },
        { status: 404 },
      );
    await db.prepare("DELETE FROM app_meta WHERE key = ?").bind(key).run();
    return json({ ok: true });
  }

  if (
    url.pathname === "/api/backend-password-resets" &&
    request.method === "POST"
  ) {
    if (!sameOriginRequest(request, url, env))
      return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });
    const userId = Number(body.userId);
    if (!Number.isInteger(userId) || userId <= 0)
      return json({ error: "Der Backend-Zugang ist ungültig." }, { status: 400 });
    const user = await db
      .prepare(
        "SELECT id, name, email FROM backend_users WHERE id = ? AND active = 1 LIMIT 1",
      )
      .bind(userId)
      .first<{ id: number; name: string; email: string }>();
    if (!user)
      return json(
        { error: "Der aktive Backend-Zugang wurde nicht gefunden." },
        { status: 404 },
      );
    const sender = await db
      .prepare(
        "SELECT * FROM email_sender_profiles WHERE active = 1 ORDER BY is_default DESC, id LIMIT 1",
      )
      .first<EmailSenderRow>();
    if (!sender?.password_ciphertext)
      return json(
        {
          error:
            "Bitte zuerst unter E-Mail-Einstellungen einen aktiven SMTP-Absender einrichten.",
        },
        { status: 400 },
      );
    const workflow = await db
      .prepare(
        "SELECT backend_password_reset_subject, backend_password_reset_template FROM workflow_settings ORDER BY id LIMIT 1",
      )
      .first<Record<string, string | null>>();
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 30 * 60_000;
    const resetUrl = `${publicAppOrigin(env, url)}/backend/passwort-zuruecksetzen/${token}`;
    const values = {
      name: String(user.name),
      email: String(user.email),
      resetUrl,
      expiresIn: "30 Minuten",
    };
    const subject = renderEmailTemplate(
      String(
        workflow?.backend_password_reset_subject ??
          "Passwort für Printcenter zurücksetzen",
      ),
      values,
    ).replace(/[\r\n]+/g, " ");
    const messageBody = renderEmailTemplate(
      String(
        workflow?.backend_password_reset_template ??
          "Guten Tag {name},\\n\\nüber den folgenden Link können Sie Ihr Passwort für das Printcenter-Backend neu setzen:\\n\\n{resetUrl}\\n\\nDer Link ist {expiresIn} gültig und kann nur einmal verwendet werden. Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.\\n\\nFreundliche Grüsse\\nPrintcenter",
      ).replaceAll("\\n", "\n"),
      values,
    );
    await db
      .prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)")
      .bind(
        `backend_password_reset:${token}`,
        JSON.stringify({ userId: user.id, expiresAt }),
      )
      .run();
    try {
      await sendSmtpMessage(
        sender,
        await decryptEmailPassword(env, db, sender.password_ciphertext),
        String(user.email),
        subject,
        messageBody,
      );
      return json({
        ok: true,
        message: `Der Reset-Link wurde an ${user.email} gesendet.`,
      });
    } catch (error) {
      await db
        .prepare("DELETE FROM app_meta WHERE key = ?")
        .bind(`backend_password_reset:${token}`)
        .run();
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Der Reset-Link konnte nicht versendet werden.",
        },
        { status: 400 },
      );
    }
  }

  if (backendPasswordResetMatch && request.method === "POST") {
    if (!sameOriginRequest(request, url, env))
      return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });
    const password = String(body.password || "");
    if (password.length < 8)
      return json(
        { error: "Das Passwort muss mindestens 8 Zeichen haben." },
        { status: 400 },
      );
    const token = backendPasswordResetMatch[1].toLowerCase();
    const key = `backend_password_reset:${token}`;
    const stored = await db
      .prepare("SELECT value FROM app_meta WHERE key = ? LIMIT 1")
      .bind(key)
      .first<{ value: string }>();
    if (!stored?.value)
      return json(
        { error: "Dieser Reset-Link ist ungültig oder wurde bereits verwendet." },
        { status: 404 },
      );
    const reset = parseJson<{ userId: number; expiresAt: number }>(
      stored.value,
      { userId: 0, expiresAt: 0 },
    );
    if (reset.expiresAt < Date.now()) {
      await db.prepare("DELETE FROM app_meta WHERE key = ?").bind(key).run();
      return json(
        { error: "Dieser Reset-Link ist abgelaufen. Bitte fordern Sie einen neuen an." },
        { status: 410 },
      );
    }
    const result = await db
      .prepare(
        "UPDATE backend_users SET password_hash = ? WHERE id = ? AND active = 1",
      )
      .bind(password, reset.userId)
      .run();
    if (!result.meta.changes)
      return json(
        { error: "Der Backend-Zugang wurde nicht gefunden." },
        { status: 404 },
      );
    await db.prepare("DELETE FROM app_meta WHERE key = ?").bind(key).run();
    return json({ ok: true });
  }

  if (url.pathname === "/api/portal-previews" && request.method === "POST") {
    if (!sameOriginRequest(request, url, env))
      return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });
    const customerId = Number(body.customerId);
    const employeeId = Number(body.employeeId);
    if (
      !Number.isInteger(customerId) ||
      customerId <= 0 ||
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    )
      return json(
        { error: "Der gewählte Mitarbeiterzugang ist ungültig." },
        { status: 400 },
      );
    const employee = await db
      .prepare(
        "SELECT e.id FROM customer_employees e JOIN customers c ON c.id = e.customer_id WHERE e.id = ? AND e.customer_id = ? AND e.active = 1 LIMIT 1",
      )
      .bind(employeeId, customerId)
      .first<{ id: number }>();
    if (!employee)
      return json(
        { error: "Der Mitarbeiterzugang wurde nicht gefunden." },
        { status: 404 },
      );
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 2 * 60_000;
    await db
      .prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)")
      .bind(
        `portal_preview:${token}`,
        JSON.stringify({ customerId, employeeId, expiresAt }),
      )
      .run();
    return json({ token, expiresAt }, { status: 201 });
  }
  if (
    portalPreviewMatch &&
    (request.method === "POST" || request.method === "DELETE")
  ) {
    const token = portalPreviewMatch[1].toLowerCase();
    const key = `portal_preview:${token}`;
    const stored = await db
      .prepare("SELECT value FROM app_meta WHERE key = ? LIMIT 1")
      .bind(key)
      .first<{ value: string }>();
    await db.prepare("DELETE FROM app_meta WHERE key = ?").bind(key).run();
    if (!stored?.value)
      return json(
        { error: "Dieser Vorschau-Link ist ungültig oder wurde bereits verwendet." },
        { status: 404 },
      );
    const preview = parseJson<{
      customerId: number;
      employeeId: number;
      expiresAt: number;
    }>(stored.value, { customerId: 0, employeeId: 0, expiresAt: 0 });
    if (preview.expiresAt <= Date.now())
      return json(
        { error: "Dieser Vorschau-Link ist abgelaufen." },
        { status: 410 },
      );
    return json(preview);
  }

  if (url.pathname === "/api/request-emails" && request.method === "POST")
    return sendRequestEmails(body, request, url, env, db);
  if (
    url.pathname === "/api/collective-request-emails" &&
    request.method === "POST"
  )
    return sendCollectiveRequestEmails(body, request, url, env, db);
  if (url.pathname === "/api/offer-emails" && request.method === "POST")
    return sendOfferEmails(body, request, url, env, db);
  if (
    url.pathname === "/api/collective-offer-emails" &&
    request.method === "POST"
  )
    return sendCollectiveOfferEmails(body, request, url, env, db);
  if (url.pathname === "/api/order-emails" && request.method === "POST")
    return sendOrderEmail(body, request, url, env, db);

  if (url.pathname.startsWith("/api/email-senders")) {
    if (!sameOriginRequest(request, url, env))
      return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });
    try {
      if (url.pathname === "/api/email-senders" && request.method === "POST") {
        const profile = validateEmailSenderBody(body);
        const password = String(body.password || "");
        if (!password)
          return json(
            { error: "Bitte ein SMTP-Passwort oder App-Passwort eingeben." },
            { status: 400 },
          );
        const count = await db
          .prepare("SELECT COUNT(*) AS count FROM email_sender_profiles")
          .first<{ count: number }>();
        const makeDefault =
          profile.active &&
          (profile.isDefault || Number(count?.count ?? 0) === 0);
        if (makeDefault)
          await db.prepare("UPDATE email_sender_profiles SET is_default = 0").run();
        const result = await db
          .prepare(
            "INSERT INTO email_sender_profiles (label, provider, from_name, from_email, reply_to, smtp_host, smtp_port, security, username, password_ciphertext, active, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            profile.label,
            profile.provider,
            profile.fromName,
            profile.fromEmail,
            profile.replyTo,
            profile.smtpHost,
            profile.smtpPort,
            profile.security,
            profile.username,
            await encryptEmailPassword(env, db, password),
            profile.active ? 1 : 0,
            makeDefault ? 1 : 0,
          )
          .run();
        const row = await db
          .prepare("SELECT * FROM email_sender_profiles WHERE id = ?")
          .bind(Number(result.meta.last_row_id))
          .first<EmailSenderRow>();
        return json(row ? publicEmailSender(row) : null, { status: 201 });
      }
      if (emailSenderMatch && !emailSenderMatch[2] && request.method === "PUT") {
        const id = Number(emailSenderMatch[1]);
        const existing = await db
          .prepare("SELECT * FROM email_sender_profiles WHERE id = ?")
          .bind(id)
          .first<EmailSenderRow>();
        if (!existing)
          return json({ error: "Absenderprofil nicht gefunden." }, { status: 404 });
        const profile = validateEmailSenderBody(body);
        const password = String(body.password || "");
        if (profile.isDefault)
          await db.prepare("UPDATE email_sender_profiles SET is_default = 0").run();
        await db
          .prepare(
            "UPDATE email_sender_profiles SET label = ?, provider = ?, from_name = ?, from_email = ?, reply_to = ?, smtp_host = ?, smtp_port = ?, security = ?, username = ?, password_ciphertext = ?, active = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          )
          .bind(
            profile.label,
            profile.provider,
            profile.fromName,
            profile.fromEmail,
            profile.replyTo,
            profile.smtpHost,
            profile.smtpPort,
            profile.security,
            profile.username,
            password
              ? await encryptEmailPassword(env, db, password)
              : existing.password_ciphertext,
            profile.active ? 1 : 0,
            profile.isDefault ? 1 : 0,
            id,
          )
          .run();
        const activeDefault = await db
          .prepare(
            "SELECT id FROM email_sender_profiles WHERE active = 1 AND is_default = 1 LIMIT 1",
          )
          .first<{ id: number }>();
        if (!activeDefault)
          await db
            .prepare(
              "UPDATE email_sender_profiles SET is_default = 1 WHERE id = (SELECT id FROM email_sender_profiles WHERE active = 1 ORDER BY id LIMIT 1)",
            )
            .run();
        const row = await db
          .prepare("SELECT * FROM email_sender_profiles WHERE id = ?")
          .bind(id)
          .first<EmailSenderRow>();
        return json(row ? publicEmailSender(row) : null);
      }
      if (emailSenderMatch && !emailSenderMatch[2] && request.method === "DELETE") {
        const id = Number(emailSenderMatch[1]);
        await db.prepare("DELETE FROM email_sender_profiles WHERE id = ?").bind(id).run();
        const activeDefault = await db
          .prepare(
            "SELECT id FROM email_sender_profiles WHERE active = 1 AND is_default = 1 LIMIT 1",
          )
          .first<{ id: number }>();
        if (!activeDefault)
          await db
            .prepare(
              "UPDATE email_sender_profiles SET is_default = 1 WHERE id = (SELECT id FROM email_sender_profiles WHERE active = 1 ORDER BY id LIMIT 1)",
            )
            .run();
        return json({ ok: true });
      }
      if (emailSenderMatch?.[2] === "test" && request.method === "POST") {
        const id = Number(emailSenderMatch[1]);
        const profile = await db
          .prepare("SELECT * FROM email_sender_profiles WHERE id = ?")
          .bind(id)
          .first<EmailSenderRow>();
        if (!profile)
          return json({ error: "Absenderprofil nicht gefunden." }, { status: 404 });
        if (!profile.password_ciphertext)
          return json(
            { error: "Für dieses Profil ist kein SMTP-Passwort gespeichert." },
            { status: 400 },
          );
        await sendSmtpTest(
          profile,
          await decryptEmailPassword(env, db, profile.password_ciphertext),
          String(body.recipient || ""),
        );
        await db
          .prepare(
            "UPDATE email_sender_profiles SET last_tested_at = CURRENT_TIMESTAMP, last_test_status = 'success', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          )
          .bind(id)
          .run();
        return json({ ok: true, message: "Die Testmail wurde erfolgreich versendet." });
      }
    } catch (error) {
      if (emailSenderMatch?.[2] === "test")
        await db
          .prepare(
            "UPDATE email_sender_profiles SET last_tested_at = CURRENT_TIMESTAMP, last_test_status = 'error', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          )
          .bind(Number(emailSenderMatch[1]))
          .run();
      return json(
        { error: error instanceof Error ? error.message : "E-Mail-Einstellungen konnten nicht verarbeitet werden." },
        { status: 400 },
      );
    }
  }

  if (employeeLoginMailMatch && request.method === "POST") {
    if (!sameOriginRequest(request, url, env))
      return json({ error: "Diese Anfrage ist nicht erlaubt." }, { status: 403 });
    const customerId = Number(employeeLoginMailMatch[1]);
    const employeeId = Number(employeeLoginMailMatch[2]);
    const employee = await db
      .prepare(
        "SELECT e.name, e.salutation, e.first_name, e.last_name, e.email, e.password_hash, c.name AS company, c.customer_number FROM customer_employees e JOIN customers c ON c.id = e.customer_id WHERE e.id = ? AND e.customer_id = ? AND e.active = 1",
      )
      .bind(employeeId, customerId)
      .first<Record<string, string | number | null>>();
    if (!employee)
      return json(
        { error: "Der aktive Mitarbeiterzugang wurde nicht gefunden." },
        { status: 404 },
      );
    const sender = await db
      .prepare(
        "SELECT * FROM email_sender_profiles WHERE active = 1 ORDER BY is_default DESC, id LIMIT 1",
      )
      .first<EmailSenderRow>();
    if (!sender?.password_ciphertext)
      return json(
        {
          error:
            "Bitte zuerst unter E-Mail-Einstellungen einen aktiven SMTP-Absender einrichten.",
        },
        { status: 400 },
      );
    const workflow = await db
      .prepare(
        "SELECT employee_login_subject, employee_login_template FROM workflow_settings ORDER BY id LIMIT 1",
      )
      .first<Record<string, string | null>>();
    const salutation =
      employee.salutation && employee.salutation !== "Divers"
        ? String(employee.salutation)
        : "";
    const values = {
      company: String(employee.company),
      salutation,
      firstName: String(employee.first_name ?? ""),
      lastName: String(employee.last_name ?? ""),
      employee: String(employee.name),
      email: String(employee.email),
      password: String(employee.password_hash),
      portalUrl: `${publicAppOrigin(env, url)}/${encodeURIComponent(String(employee.customer_number))}`,
    };
    const subject = renderEmailTemplate(
      String(
        workflow?.employee_login_subject ??
          "Ihr Zugang zum Printcenter von {company}",
      ),
      values,
    ).replace(/[\r\n]+/g, " ");
    const messageBody = renderEmailTemplate(
      String(
        workflow?.employee_login_template ??
          "Guten Tag {salutation} {lastName},\\n\\nIhr persönlicher Zugang zum Kundenportal von {company} ist eingerichtet.\\n\\nPortal: {portalUrl}\\nLogin: {email}\\nPasswort: {password}\\n\\nBitte bewahren Sie diese Zugangsdaten sicher auf.\\n\\nFreundliche Grüsse\\nPrintcenter",
      ).replaceAll("\\n", "\n"),
      values,
    );
    try {
      await sendSmtpMessage(
        sender,
        await decryptEmailPassword(env, db, sender.password_ciphertext),
        String(employee.email),
        subject,
        messageBody,
      );
      return json({ ok: true });
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Die Zugangsdaten konnten nicht versendet werden.",
        },
        { status: 400 },
      );
    }
  }

  if (url.pathname === "/api/integrations" && request.method === "PUT") {
    await ensureFullSchema(db);
    const protocol =
      String(body.ftpProtocol || "SFTP") === "FTP" ? "FTP" : "SFTP";
    const allowedIntervals = new Set([0, 15, 30, 60, 180, 360, 720, 1440]);
    const requestedInterval = Number(body.sftpPullIntervalMinutes ?? 60);
    const pullInterval = allowedIntervals.has(requestedInterval)
      ? requestedInterval
      : 60;
    const entity = ["customers", "suppliers", "articles"].includes(
      String(body.sftpCsvEntity),
    )
      ? String(body.sftpCsvEntity)
      : "articles";
    const delimiter = [";", ",", "tab"].includes(
      String(body.sftpCsvDelimiter),
    )
      ? String(body.sftpCsvDelimiter)
      : ";";
    const mappings = Array.isArray(body.sftpCsvMappings)
      ? body.sftpCsvMappings
          .slice(0, 100)
          .map((mapping) => {
            const item = mapping as Record<string, unknown>;
            return {
              csvColumn: String(item.csvColumn || "").trim().slice(0, 120),
              targetField: String(item.targetField || "").trim().slice(0, 120),
            };
          })
          .filter((mapping) => mapping.csvColumn || mapping.targetField)
      : [];
    await db
      .prepare(
        "INSERT INTO integration_settings (id, navision_endpoint, navision_tenant, api_base_url, api_client_id, ftp_protocol, ftp_host, ftp_port, ftp_username, ftp_directory, sftp_pull_interval_minutes, sftp_csv_entity, sftp_csv_delimiter, sftp_csv_has_header, sftp_csv_file_pattern, sftp_csv_mapping_json, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET navision_endpoint = excluded.navision_endpoint, navision_tenant = excluded.navision_tenant, api_base_url = excluded.api_base_url, api_client_id = excluded.api_client_id, ftp_protocol = excluded.ftp_protocol, ftp_host = excluded.ftp_host, ftp_port = excluded.ftp_port, ftp_username = excluded.ftp_username, ftp_directory = excluded.ftp_directory, sftp_pull_interval_minutes = excluded.sftp_pull_interval_minutes, sftp_csv_entity = excluded.sftp_csv_entity, sftp_csv_delimiter = excluded.sftp_csv_delimiter, sftp_csv_has_header = excluded.sftp_csv_has_header, sftp_csv_file_pattern = excluded.sftp_csv_file_pattern, sftp_csv_mapping_json = excluded.sftp_csv_mapping_json, updated_at = CURRENT_TIMESTAMP",
      )
      .bind(
        body.navisionEndpoint || "",
        body.navisionTenant || "",
        body.apiBaseUrl || "",
        body.apiClientId || "",
        protocol,
        body.ftpHost || "",
        body.ftpPort || (protocol === "SFTP" ? "22" : "21"),
        body.ftpUsername || "",
        body.ftpDirectory || "/printcenter",
        pullInterval,
        entity,
        delimiter,
        body.sftpCsvHasHeader === false ? 0 : 1,
        String(body.sftpCsvFilePattern || "*.csv").trim().slice(0, 160) ||
          "*.csv",
        JSON.stringify(mappings),
      )
      .run();
    return json(await readIntegrationSettings(db));
  }

  if (request.method === "POST" && url.pathname === "/api/customers") {
    const number = await nextNumber(db, "customers");
    const result = await db
      .prepare(
        "INSERT INTO customers (customer_number, name, contact_salutation, contact_first_name, contact_last_name, email, phone, street, postal_code, city, country, markup_percent, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        number,
        body.name,
        body.contactSalutation || "Divers",
        body.contactFirstName || "",
        body.contactLastName || "",
        body.email,
        body.phone,
        body.street,
        body.postalCode,
        body.city,
        body.country || "Schweiz",
        Number(body.markup || 0),
        "draft",
      )
      .run();
    return json(
      {
        ...(await readDirectory(db)).customers.find(
          (customer) => customer.id === Number(result.meta.last_row_id),
        ),
      },
      { status: 201 },
    );
  }
  if (customerMatch && request.method === "PUT") {
    await db
      .prepare(
        "UPDATE customers SET name = ?, contact_salutation = ?, contact_first_name = ?, contact_last_name = ?, email = ?, phone = ?, street = ?, postal_code = ?, city = ?, country = ?, markup_percent = ? WHERE id = ?",
      )
      .bind(
        body.name,
        body.contactSalutation || "Divers",
        body.contactFirstName || "",
        body.contactLastName || "",
        body.email,
        body.phone,
        body.street,
        body.postalCode,
        body.city,
        body.country || "Schweiz",
        Number(body.markup || 0),
        Number(customerMatch[1]),
      )
      .run();
    return json(
      (await readDirectory(db)).customers.find(
        (customer) => customer.id === Number(customerMatch[1]),
      ),
    );
  }
  if (customerMatch && request.method === "DELETE") {
    const id = Number(customerMatch[1]);
    const statements: D1PreparedStatement[] = [];
    if (await tableExists(db, "documents"))
      statements.push(
        db
          .prepare(
            "UPDATE documents SET customer_employee_id = NULL, customer_id = NULL WHERE customer_id = ?",
          )
          .bind(id),
      );
    if (await tableExists(db, "articles"))
      statements.push(
        db
          .prepare(
            "UPDATE articles SET customer_id = NULL WHERE customer_id = ?",
          )
          .bind(id),
      );
    if (await tableExists(db, "customer_accounts"))
      statements.push(
        db
          .prepare("DELETE FROM customer_accounts WHERE customer_id = ?")
          .bind(id),
      );
    statements.push(
      db
        .prepare("DELETE FROM customer_employees WHERE customer_id = ?")
        .bind(id),
      db.prepare("DELETE FROM customers WHERE id = ?").bind(id),
    );
    await db.batch(statements);
    return json({ ok: true });
  }
  if (employeeMatch && request.method === "POST") {
    const customerId = Number(employeeMatch[1]);
    const result = await db
      .prepare(
        "INSERT INTO customer_employees (customer_id, name, salutation, first_name, last_name, email, phone, login, password_hash, mail_to_main) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        customerId,
        body.name,
        body.salutation || "Divers",
        body.firstName || "",
        body.lastName || "",
        body.email,
        body.phone,
        body.email,
        body.password || "portal",
        body.mailToMain ? 1 : 0,
      )
      .run();
    const directory = await readDirectory(db);
    return json(
      directory.customers
        .find((customer) => customer.id === customerId)
        ?.employees.find(
          (employee) => employee.id === Number(result.meta.last_row_id),
        ),
      { status: 201 },
    );
  }
  if (employeeMatch?.[2] && request.method === "PUT") {
    const employeeId = Number(employeeMatch[2]);
    if (body.password)
      await db
        .prepare(
          "UPDATE customer_employees SET name = ?, salutation = ?, first_name = ?, last_name = ?, email = ?, phone = ?, login = ?, password_hash = ?, mail_to_main = ? WHERE id = ?",
        )
        .bind(
          body.name,
          body.salutation || "Divers",
          body.firstName || "",
          body.lastName || "",
          body.email,
          body.phone,
          body.email,
          body.password,
          body.mailToMain ? 1 : 0,
          employeeId,
        )
        .run();
    else
      await db
        .prepare(
          "UPDATE customer_employees SET name = ?, salutation = ?, first_name = ?, last_name = ?, email = ?, phone = ?, login = ?, mail_to_main = ? WHERE id = ?",
        )
        .bind(
          body.name,
          body.salutation || "Divers",
          body.firstName || "",
          body.lastName || "",
          body.email,
          body.phone,
          body.email,
          body.mailToMain ? 1 : 0,
          employeeId,
        )
        .run();
    const directory = await readDirectory(db);
    return json(
      directory.customers
        .find((customer) => customer.id === Number(employeeMatch[1]))
        ?.employees.find((employee) => employee.id === employeeId),
    );
  }
  if (employeeMatch?.[2] && request.method === "DELETE") {
    const employeeId = Number(employeeMatch[2]);
    if (await tableExists(db, "documents"))
      await db
        .prepare(
          "UPDATE documents SET customer_employee_id = NULL WHERE customer_employee_id = ?",
        )
        .bind(employeeId)
        .run();
    await db
      .prepare(
        "DELETE FROM customer_employees WHERE id = ? AND customer_id = ?",
      )
      .bind(employeeId, Number(employeeMatch[1]))
      .run();
    return json({ ok: true });
  }

  if (request.method === "POST" && url.pathname === "/api/suppliers") {
    const number = await nextNumber(db, "suppliers");
    const groupId = await resolveGroupId(db, String(body.group || ""));
    const result = await db
      .prepare(
        "INSERT INTO suppliers (supplier_number, name, contact_name, email, phone, group_id) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        number,
        body.name,
        body.contact,
        body.email,
        body.phone,
        groupId,
      )
      .run();
    return json(
      (await readDirectory(db)).suppliers.find(
        (supplier) => supplier.id === Number(result.meta.last_row_id),
      ),
      { status: 201 },
    );
  }
  if (supplierMatch && request.method === "PUT") {
    const groupId = await resolveGroupId(db, String(body.group || ""));
    await db
      .prepare(
        "UPDATE suppliers SET name = ?, contact_name = ?, email = ?, phone = ?, group_id = ? WHERE id = ?",
      )
      .bind(
        body.name,
        body.contact,
        body.email,
        body.phone,
        groupId,
        Number(supplierMatch[1]),
      )
      .run();
    return json(
      (await readDirectory(db)).suppliers.find(
        (supplier) => supplier.id === Number(supplierMatch[1]),
      ),
    );
  }
  if (supplierMatch && request.method === "DELETE") {
    const id = Number(supplierMatch[1]);
    const statements: D1PreparedStatement[] = [];
    if (await tableExists(db, "documents"))
      statements.push(
        db
          .prepare(
            "UPDATE documents SET supplier_id = NULL WHERE supplier_id = ?",
          )
          .bind(id),
      );
    if (await tableExists(db, "articles"))
      statements.push(
        db
          .prepare(
            "UPDATE articles SET supplier_id = NULL WHERE supplier_id = ?",
          )
          .bind(id),
      );
    statements.push(db.prepare("DELETE FROM suppliers WHERE id = ?").bind(id));
    await db.batch(statements);
    return json({ ok: true });
  }
  if (request.method === "POST" && url.pathname === "/api/supplier-groups") {
    await db
      .prepare("INSERT OR IGNORE INTO supplier_groups (name) VALUES (?)")
      .bind(body.name)
      .run();
    return json({ name: body.name }, { status: 201 });
  }
  if (
    request.method === "DELETE" &&
    url.pathname.startsWith("/api/supplier-groups/")
  ) {
    const name = decodeURIComponent(
      url.pathname.slice("/api/supplier-groups/".length),
    );
    const group = await db
      .prepare("SELECT id FROM supplier_groups WHERE name = ?")
      .bind(name)
      .first<{ id: number }>();
    if (group) {
      const statements: D1PreparedStatement[] = [
        db
          .prepare("UPDATE suppliers SET group_id = NULL WHERE group_id = ?")
          .bind(group.id),
      ];
      if (await tableExists(db, "articles"))
        statements.push(
          db
            .prepare(
              "UPDATE articles SET supplier_group_id = NULL WHERE supplier_group_id = ?",
            )
            .bind(group.id),
        );
      statements.push(
        db.prepare("DELETE FROM supplier_groups WHERE id = ?").bind(group.id),
      );
      await db.batch(statements);
    }
    return json({ ok: true });
  }
  return json({ error: "Nicht gefunden" }, { status: 404 });
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(
    request: Request,
    env: Env | undefined,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const bindings = env;
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      if (!bindings?.IMAGES)
        return new Response("Image service unavailable", { status: 503 });
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            env.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await bindings.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
      );
    }

    if (url.pathname === "/api/files" && request.method === "POST") {
      if (!bindings?.FILES)
        return json(
          { error: "Der Dateispeicher ist nicht verbunden." },
          { status: 503 },
        );
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0)
        return json(
          { error: "Bitte eine gültige Datei auswählen." },
          { status: 400 },
        );
      const safeName =
        file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") ||
        "datei";
      const key = `uploads/${crypto.randomUUID()}-${safeName}`;
      await bindings.FILES.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type || "application/octet-stream",
          contentDisposition: `inline; filename="${safeName}"`,
        },
        customMetadata: { originalName: file.name },
      });
      return json({
        name: file.name,
        key,
        url: `/api/files/${encodeURIComponent(key)}`,
      });
    }

    if (url.pathname.startsWith("/api/files/") && request.method === "GET") {
      if (!bindings?.FILES)
        return new Response("Dateispeicher nicht verbunden", { status: 503 });
      const key = decodeURIComponent(url.pathname.slice("/api/files/".length));
      const object = await bindings.FILES.get(key);
      if (!object) return new Response("Datei nicht gefunden", { status: 404 });
      const headers = new Headers({
        "Cache-Control": "private, max-age=300",
        ETag: object.httpEtag,
      });
      object.writeHttpMetadata(headers);
      return new Response(object.body, { headers });
    }

    if (url.pathname.startsWith("/api/")) {
      if (!bindings?.DB)
        return json(
          {
            error:
              "Die Datenbank ist in dieser lokalen Produktionsvorschau nicht verbunden.",
          },
          { status: 503 },
        );
      try {
        return await handleDirectoryApi(request, bindings, bindings.DB, url);
      } catch (error) {
        console.error(error);
        return json(
          { error: "Die Änderung konnte nicht gespeichert werden." },
          { status: 500 },
        );
      }
    }

    return handler.fetch(request, bindings as Env, ctx);
  },
};

export default worker;
