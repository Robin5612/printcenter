import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const customers = sqliteTable(
  "customers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerNumber: text("customer_number").notNull(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    contactSalutation: text("contact_salutation"),
    contactFirstName: text("contact_first_name"),
    contactLastName: text("contact_last_name"),
    email: text("email"),
    phone: text("phone"),
    street: text("street"),
    postalCode: text("postal_code"),
    city: text("city"),
    country: text("country").notNull().default("Schweiz"),
    markupPercent: real("markup_percent").notNull().default(0),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("customers_customer_number_unique").on(table.customerNumber),
    index("idx_customers_name").on(table.name),
  ],
);

export const customerEmployees = sqliteTable(
  "customer_employees",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    salutation: text("salutation"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email").notNull(),
    phone: text("phone"),
    login: text("login").notNull(),
    passwordHash: text("password_hash").notNull(),
    mailToMain: integer("mail_to_main", { mode: "boolean" })
      .notNull()
      .default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("customer_employees_login_unique").on(table.login),
    uniqueIndex("customer_employees_email_unique").on(table.email),
    index("idx_customer_employees_customer_id").on(table.customerId),
  ],
);

// Kept during the transition from the first prototype. Existing password hashes
// remain intact until customer accounts have been migrated to employee logins.
export const customerAccounts = sqliteTable(
  "customer_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [
    uniqueIndex("customer_accounts_email_unique").on(table.email),
    index("idx_customer_accounts_customer_id").on(table.customerId),
  ],
);

export const supplierGroups = sqliteTable(
  "supplier_groups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
  },
  (table) => [uniqueIndex("supplier_groups_name_unique").on(table.name)],
);

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    supplierNumber: text("supplier_number").notNull(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    email: text("email"),
    phone: text("phone"),
    groupId: integer("group_id").references(() => supplierGroups.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("suppliers_supplier_number_unique").on(table.supplierNumber),
    index("idx_suppliers_group_id").on(table.groupId),
    index("idx_suppliers_name").on(table.name),
  ],
);

export const articles = sqliteTable(
  "articles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sku: text("sku").notNull(),
    designation1: text("designation_1").notNull(),
    designation2: text("designation_2").notNull().default(""),
    customerId: integer("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    supplierId: integer("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    supplierGroupId: integer("supplier_group_id").references(
      () => supplierGroups.id,
      { onDelete: "set null" },
    ),
    stock: integer("stock").notNull().default(0),
    reorderPoint: integer("reorder_point").notNull().default(0),
    unitPrice: real("unit_price").notNull().default(0),
    stockHistoryJson: text("stock_history_json").notNull().default("[]"),
    legacyPrintFileKey: text("print_file_key"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("articles_sku_unique").on(table.sku),
    index("idx_articles_customer_id").on(table.customerId),
    index("idx_articles_supplier_id").on(table.supplierId),
  ],
);

export const gzdTemplates = sqliteTable(
  "gzd_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    objectKey: text("object_key").notNull(),
    uploadedAt: text("uploaded_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_gzd_templates_article_id_uploaded_at").on(
      table.articleId,
      table.uploadedAt,
    ),
  ],
);

export const stockEvents = sqliteTable(
  "stock_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    articleId: integer("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    occurredAt: text("occurred_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    change: integer("change").notNull(),
    stockAfter: integer("stock_after").notNull(),
    reason: text("reason").notNull(),
  },
  (table) => [
    index("idx_stock_events_article_id_occurred_at").on(
      table.articleId,
      table.occurredAt,
    ),
  ],
);

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey(),
    title: text("title").notNull(),
    status: text("status").notNull().default("requested"),
    customerId: integer("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    customerEmployeeId: integer("customer_employee_id").references(
      () => customerEmployees.id,
      { onDelete: "set null" },
    ),
    articleId: integer("article_id").references(() => articles.id, {
      onDelete: "set null",
    }),
    supplierId: integer("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    supplierGroupId: integer("supplier_group_id").references(
      () => supplierGroups.id,
      { onDelete: "set null" },
    ),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_projects_customer_id_status").on(table.customerId, table.status),
    index("idx_projects_article_id").on(table.articleId),
    index("idx_projects_supplier_id").on(table.supplierId),
  ],
);

export const documents = sqliteTable(
  "documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    documentNumber: text("document_number").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("draft"),
    customerId: integer("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    customerEmployeeId: integer("customer_employee_id").references(
      () => customerEmployees.id,
      { onDelete: "set null" },
    ),
    supplierId: integer("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    subtotal: real("subtotal").notNull().default(0),
    markupPercent: real("markup_percent").notNull().default(0),
    markupAmount: real("markup_amount").notNull().default(0),
    total: real("total").notNull().default(0),
    issuedAt: text("issued_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    projectId: integer("project_id").references(() => projects.id, {
      onDelete: "cascade",
    }),
    supplierToken: text("supplier_token"),
    deliveryDate: text("delivery_date"),
    supplierLeadTime: text("supplier_lead_time"),
    supplierDeliveryDate: text("supplier_delivery_date"),
    supplierDeliveryNote: text("supplier_delivery_note"),
    supplierReference: text("supplier_reference"),
    bindingDeliveryConfirmationDue: text("binding_delivery_confirmation_due"),
    requestedQuantitiesJson: text("requested_quantities_json")
      .notNull()
      .default("[]"),
    note: text("note"),
    requestText: text("request_text"),
    documentText: text("document_text"),
    supplierNote: text("supplier_note"),
    attachDocument: integer("attach_document", { mode: "boolean" })
      .notNull()
      .default(true),
    attachGzd: integer("attach_gzd", { mode: "boolean" })
      .notNull()
      .default(true),
    printFileKey: text("print_file_key"),
    supplierGzdKey: text("supplier_gzd_key"),
    gzdStatus: text("gzd_status"),
    pdfObjectKey: text("pdf_object_key"),
    payload: text("payload").notNull().default("{}"),
  },
  (table) => [
    uniqueIndex("documents_document_number_unique").on(table.documentNumber),
    index("idx_documents_type_status").on(table.type, table.status),
    index("idx_documents_customer_id_issued_at").on(
      table.customerId,
      table.issuedAt,
    ),
    index("idx_documents_customer_employee_id_issued_at").on(
      table.customerEmployeeId,
      table.issuedAt,
    ),
  ],
);

export const documentLines = sqliteTable(
  "document_lines",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    articleId: integer("article_id").references(() => articles.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: real("unit_price").notNull(),
    lineTotal: real("line_total").notNull(),
  },
  (table) => [index("idx_document_lines_document_id").on(table.documentId)],
);

export const documentOfferOptions = sqliteTable(
  "document_offer_options",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    supplierUnitPrice: real("supplier_unit_price").notNull(),
    supplierTotal: real("supplier_total").notNull(),
  },
  (table) => [
    uniqueIndex("document_offer_options_document_quantity_unique").on(
      table.documentId,
      table.quantity,
    ),
    index("idx_document_offer_options_document_id").on(table.documentId),
  ],
);

export const documentAttachments = sqliteTable(
  "document_attachments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    fileName: text("file_name").notNull(),
    objectKey: text("object_key").notNull(),
    uploadedAt: text("uploaded_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_document_attachments_document_id_kind").on(
      table.documentId,
      table.kind,
    ),
    uniqueIndex("document_attachments_object_key_unique").on(table.objectKey),
  ],
);

export const backendUsers = sqliteTable(
  "backend_users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("operator"),
    passwordHash: text("password_hash").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("backend_users_email_unique").on(table.email),
    index("idx_backend_users_active").on(table.active),
  ],
);

export const workflowSettings = sqliteTable("workflow_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestTemplate: text("request_template").notNull(),
  offerTemplate: text("offer_template").notNull(),
  orderTemplate: text("order_template").notNull(),
  confirmationTemplate: text("confirmation_template").notNull(),
  reorderPointSubject: text("reorder_point_subject")
    .notNull()
    .default("Meldebestand erreicht: {sku} · {article}"),
  reorderPointTemplate: text("reorder_point_template")
    .notNull()
    .default(
      "Guten Tag {customer},\n\nder Meldebestand für den Artikel {sku} · {article} wurde erreicht.\n\nAktueller Bestand: {stock} Stück\nMeldebestand: {minimum} Stück\n\nBitte prüfen Sie eine Nachbestellung.\n\nFreundliche Grüsse\nPrintcenter",
    ),
  requestRecipient: text("request_recipient").notNull().default("supplier"),
  offerRecipient: text("offer_recipient").notNull().default("customer"),
  orderRecipient: text("order_recipient").notNull().default("system"),
  confirmationRecipient: text("confirmation_recipient")
    .notNull()
    .default("customer"),
  reorderPointRecipient: text("reorder_point_recipient")
    .notNull()
    .default("customer"),
  employeeLoginSubject: text("employee_login_subject")
    .notNull()
    .default("Ihr Zugang zum Printcenter von {company}"),
  employeeLoginTemplate: text("employee_login_template")
    .notNull()
    .default(
      "Guten Tag {salutation} {lastName},\n\nIhr persönlicher Zugang zum Kundenportal von {company} ist eingerichtet.\n\nPortal: {portalUrl}\nLogin: {email}\nPasswort: {password}\n\nBitte bewahren Sie diese Zugangsdaten sicher auf.\n\nFreundliche Grüsse\nPrintcenter",
    ),
  customerPasswordResetSubject: text("customer_password_reset_subject")
    .notNull()
    .default("Passwort für Ihr Printcenter-Kundenportal zurücksetzen"),
  customerPasswordResetTemplate: text("customer_password_reset_template")
    .notNull()
    .default(
      "Guten Tag {salutation} {lastName},\n\nüber den folgenden Link können Sie Ihr Passwort für das Kundenportal von {company} neu setzen:\n\n{resetUrl}\n\nDer Link ist {expiresIn} gültig und kann nur einmal verwendet werden. Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.\n\nFreundliche Grüsse\nPrintcenter",
    ),
  backendPasswordResetSubject: text("backend_password_reset_subject")
    .notNull()
    .default("Passwort für Printcenter zurücksetzen"),
  backendPasswordResetTemplate: text("backend_password_reset_template")
    .notNull()
    .default(
      "Guten Tag {name},\n\nüber den folgenden Link können Sie Ihr Passwort für das Printcenter-Backend neu setzen:\n\n{resetUrl}\n\nDer Link ist {expiresIn} gültig und kann nur einmal verwendet werden. Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.\n\nFreundliche Grüsse\nPrintcenter",
    ),
  supplierOfferSubject: text("supplier_offer_subject").notNull(),
  offerEmail: text("offer_email").notNull(),
  orderEmail: text("order_email").notNull(),
  attachRequestDocument: integer("attach_request_document", { mode: "boolean" })
    .notNull()
    .default(true),
  attachRequestGzd: integer("attach_request_gzd", { mode: "boolean" })
    .notNull()
    .default(true),
  attachOfferDocument: integer("attach_offer_document", { mode: "boolean" })
    .notNull()
    .default(true),
  attachOfferGzd: integer("attach_offer_gzd", { mode: "boolean" })
    .notNull()
    .default(true),
  attachOrderDocument: integer("attach_order_document", { mode: "boolean" })
    .notNull()
    .default(true),
  attachOrderGzd: integer("attach_order_gzd", { mode: "boolean" })
    .notNull()
    .default(true),
  attachConfirmationDocument: integer("attach_confirmation_document", {
    mode: "boolean",
  })
    .notNull()
    .default(true),
  attachConfirmationGzd: integer("attach_confirmation_gzd", { mode: "boolean" })
    .notNull()
    .default(true),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const integrationSettings = sqliteTable("integration_settings", {
  id: integer("id").primaryKey(),
  navisionEndpoint: text("navision_endpoint").notNull().default(""),
  navisionTenant: text("navision_tenant").notNull().default(""),
  apiBaseUrl: text("api_base_url").notNull().default(""),
  apiClientId: text("api_client_id").notNull().default(""),
  ftpProtocol: text("ftp_protocol").notNull().default("SFTP"),
  ftpHost: text("ftp_host").notNull().default(""),
  ftpPort: text("ftp_port").notNull().default("22"),
  ftpUsername: text("ftp_username").notNull().default(""),
  ftpDirectory: text("ftp_directory").notNull().default("/printcenter"),
  sftpPullIntervalMinutes: integer("sftp_pull_interval_minutes")
    .notNull()
    .default(60),
  sftpCsvEntity: text("sftp_csv_entity").notNull().default("articles"),
  sftpCsvDelimiter: text("sftp_csv_delimiter").notNull().default(";"),
  sftpCsvHasHeader: integer("sftp_csv_has_header", { mode: "boolean" })
    .notNull()
    .default(true),
  sftpCsvFilePattern: text("sftp_csv_file_pattern")
    .notNull()
    .default("*.csv"),
  sftpCsvMappingJson: text("sftp_csv_mapping_json")
    .notNull()
    .default("[]"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const emailSenderProfiles = sqliteTable(
  "email_sender_profiles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    label: text("label").notNull(),
    provider: text("provider").notNull().default("custom"),
    fromName: text("from_name").notNull(),
    fromEmail: text("from_email").notNull(),
    replyTo: text("reply_to").notNull().default(""),
    smtpHost: text("smtp_host").notNull(),
    smtpPort: integer("smtp_port").notNull().default(587),
    security: text("security").notNull().default("starttls"),
    username: text("username").notNull(),
    passwordCiphertext: text("password_ciphertext"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    lastTestedAt: text("last_tested_at"),
    lastTestStatus: text("last_test_status"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_email_sender_profiles_active_default").on(
      table.active,
      table.isDefault,
    ),
  ],
);

export const navisionSyncLog = sqliteTable(
  "navision_sync_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    direction: text("direction").notNull(),
    status: text("status").notNull().default("pending"),
    externalReference: text("external_reference"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("idx_navision_sync_log_status_created_at").on(
      table.status,
      table.createdAt,
    ),
  ],
);
