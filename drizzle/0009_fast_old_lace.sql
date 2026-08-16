CREATE TABLE `document_attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` integer NOT NULL,
	`kind` text NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_document_attachments_document_id_kind` ON `document_attachments` (`document_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_attachments_object_key_unique` ON `document_attachments` (`object_key`);--> statement-breakpoint
CREATE TABLE `document_offer_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`supplier_unit_price` real NOT NULL,
	`supplier_total` real NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_offer_options_document_quantity_unique` ON `document_offer_options` (`document_id`,`quantity`);--> statement-breakpoint
CREATE INDEX `idx_document_offer_options_document_id` ON `document_offer_options` (`document_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`customer_id` integer,
	`customer_employee_id` integer,
	`article_id` integer,
	`supplier_id` integer,
	`supplier_group_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`customer_employee_id`) REFERENCES `customer_employees`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supplier_group_id`) REFERENCES `supplier_groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_projects_customer_id_status` ON `projects` (`customer_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_projects_article_id` ON `projects` (`article_id`);--> statement-breakpoint
CREATE INDEX `idx_projects_supplier_id` ON `projects` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `stock_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`change` integer NOT NULL,
	`stock_after` integer NOT NULL,
	`reason` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_stock_events_article_id_occurred_at` ON `stock_events` (`article_id`,`occurred_at`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`customer_id` integer,
	`supplier_id` integer,
	`supplier_group_id` integer,
	`stock` integer DEFAULT 0 NOT NULL,
	`reorder_point` integer DEFAULT 0 NOT NULL,
	`unit_price` real DEFAULT 0 NOT NULL,
	`tier_quantities_json` text DEFAULT '[100,250,500,1000,2000]' NOT NULL,
	`stock_history_json` text DEFAULT '[]' NOT NULL,
	`print_file_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supplier_group_id`) REFERENCES `supplier_groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_articles`("id", "sku", "name", "customer_id", "supplier_id", "supplier_group_id", "stock", "reorder_point", "unit_price", "tier_quantities_json", "stock_history_json", "print_file_key", "created_at") SELECT "id", "sku", "name", "customer_id", "supplier_id", "supplier_group_id", "stock", "reorder_point", "unit_price", "tier_quantities_json", "stock_history_json", "print_file_key", "created_at" FROM `articles`;--> statement-breakpoint
DROP TABLE `articles`;--> statement-breakpoint
ALTER TABLE `__new_articles` RENAME TO `articles`;--> statement-breakpoint
CREATE UNIQUE INDEX `articles_sku_unique` ON `articles` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_articles_customer_id` ON `articles` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_articles_supplier_id` ON `articles` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `__new_customer_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_customer_accounts`("id", "customer_id", "email", "password_hash", "active") SELECT "id", "customer_id", "email", "password_hash", "active" FROM `customer_accounts`;--> statement-breakpoint
DROP TABLE `customer_accounts`;--> statement-breakpoint
ALTER TABLE `__new_customer_accounts` RENAME TO `customer_accounts`;--> statement-breakpoint
CREATE UNIQUE INDEX `customer_accounts_email_unique` ON `customer_accounts` (`email`);--> statement-breakpoint
CREATE INDEX `idx_customer_accounts_customer_id` ON `customer_accounts` (`customer_id`);--> statement-breakpoint
CREATE TABLE `__new_customer_employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`login` text NOT NULL,
	`password_hash` text NOT NULL,
	`mail_to_main` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_customer_employees`("id", "customer_id", "name", "email", "phone", "login", "password_hash", "mail_to_main", "active", "created_at") SELECT "id", "customer_id", "name", "email", "phone", "login", "password_hash", "mail_to_main", "active", "created_at" FROM `customer_employees`;--> statement-breakpoint
DROP TABLE `customer_employees`;--> statement-breakpoint
ALTER TABLE `__new_customer_employees` RENAME TO `customer_employees`;--> statement-breakpoint
CREATE UNIQUE INDEX `customer_employees_login_unique` ON `customer_employees` (`login`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_employees_email_unique` ON `customer_employees` (`email`);--> statement-breakpoint
CREATE INDEX `idx_customer_employees_customer_id` ON `customer_employees` (`customer_id`);--> statement-breakpoint
CREATE TABLE `__new_document_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` integer NOT NULL,
	`article_id` integer,
	`title` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	`line_total` real NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_document_lines`("id", "document_id", "article_id", "title", "quantity", "unit_price", "line_total") SELECT "id", "document_id", "article_id", "title", "quantity", "unit_price", "line_total" FROM `document_lines`;--> statement-breakpoint
DROP TABLE `document_lines`;--> statement-breakpoint
ALTER TABLE `__new_document_lines` RENAME TO `document_lines`;--> statement-breakpoint
CREATE INDEX `idx_document_lines_document_id` ON `document_lines` (`document_id`);--> statement-breakpoint
INSERT OR IGNORE INTO `projects` (`id`, `title`, `status`, `customer_id`, `customer_employee_id`, `supplier_id`, `created_at`, `updated_at`)
SELECT `project_id`, 'Projekt ' || `project_id`,
	CASE
		WHEN MAX(CASE WHEN `type` = 'Auftragsbestätigung' THEN 4 WHEN `type` = 'Bestellung' THEN 3 WHEN `type` = 'Angebot' THEN 2 ELSE 1 END) = 4 THEN 'confirmed'
		WHEN MAX(CASE WHEN `type` = 'Auftragsbestätigung' THEN 4 WHEN `type` = 'Bestellung' THEN 3 WHEN `type` = 'Angebot' THEN 2 ELSE 1 END) = 3 THEN 'ordered'
		WHEN MAX(CASE WHEN `type` = 'Auftragsbestätigung' THEN 4 WHEN `type` = 'Bestellung' THEN 3 WHEN `type` = 'Angebot' THEN 2 ELSE 1 END) = 2 THEN 'quoted'
		ELSE 'requested'
	END,
	MAX(`customer_id`), MAX(`customer_employee_id`), MAX(`supplier_id`), MIN(`issued_at`), MAX(`issued_at`)
FROM `documents`
WHERE `project_id` IS NOT NULL
GROUP BY `project_id`;--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_number` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`customer_id` integer,
	`customer_employee_id` integer,
	`supplier_id` integer,
	`subtotal` real DEFAULT 0 NOT NULL,
	`markup_percent` real DEFAULT 0 NOT NULL,
	`markup_amount` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`issued_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`project_id` integer,
	`supplier_token` text,
	`delivery_date` text,
	`supplier_lead_time` text,
	`binding_delivery_confirmation_due` text,
	`requested_quantities_json` text DEFAULT '[]' NOT NULL,
	`note` text,
	`request_text` text,
	`document_text` text,
	`supplier_note` text,
	`attach_document` integer DEFAULT true NOT NULL,
	`attach_gzd` integer DEFAULT true NOT NULL,
	`print_file_key` text,
	`supplier_gzd_key` text,
	`pdf_object_key` text,
	`payload` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`customer_employee_id`) REFERENCES `customer_employees`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_documents`("id", "document_number", "type", "status", "customer_id", "customer_employee_id", "supplier_id", "subtotal", "markup_percent", "markup_amount", "total", "issued_at", "project_id", "supplier_token", "delivery_date", "supplier_lead_time", "binding_delivery_confirmation_due", "requested_quantities_json", "note", "request_text", "document_text", "supplier_note", "attach_document", "attach_gzd", "print_file_key", "supplier_gzd_key", "pdf_object_key", "payload") SELECT "id", "document_number", "type", "status", "customer_id", "customer_employee_id", "supplier_id", "subtotal", "markup_percent", "markup_amount", "total", "issued_at", "project_id", "supplier_token", "delivery_date", NULL, NULL, '[]', "note", NULL, NULL, NULL, 1, 1, "print_file_key", "supplier_gzd_key", "pdf_object_key", "payload" FROM `documents`;--> statement-breakpoint
DROP TABLE `documents`;--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;--> statement-breakpoint
CREATE UNIQUE INDEX `documents_document_number_unique` ON `documents` (`document_number`);--> statement-breakpoint
CREATE INDEX `idx_documents_type_status` ON `documents` (`type`,`status`);--> statement-breakpoint
CREATE INDEX `idx_documents_customer_id_issued_at` ON `documents` (`customer_id`,`issued_at`);--> statement-breakpoint
CREATE INDEX `idx_documents_customer_employee_id_issued_at` ON `documents` (`customer_employee_id`,`issued_at`);--> statement-breakpoint
CREATE TABLE `__new_gzd_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_gzd_templates`("id", "article_id", "file_name", "object_key", "uploaded_at") SELECT "id", "article_id", "file_name", "object_key", "uploaded_at" FROM `gzd_templates`;--> statement-breakpoint
DROP TABLE `gzd_templates`;--> statement-breakpoint
ALTER TABLE `__new_gzd_templates` RENAME TO `gzd_templates`;--> statement-breakpoint
CREATE INDEX `idx_gzd_templates_article_id_uploaded_at` ON `gzd_templates` (`article_id`,`uploaded_at`);--> statement-breakpoint
CREATE TABLE `__new_suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_number` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`email` text,
	`phone` text,
	`lead_time_days` integer,
	`lead_time_text` text,
	`group_id` integer,
	FOREIGN KEY (`group_id`) REFERENCES `supplier_groups`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_suppliers`("id", "supplier_number", "name", "contact_name", "email", "phone", "lead_time_days", "lead_time_text", "group_id") SELECT "id", "supplier_number", "name", "contact_name", "email", "phone", "lead_time_days", CASE WHEN "lead_time_days" IS NULL THEN NULL ELSE "lead_time_days" || ' Arbeitstage' END, "group_id" FROM `suppliers`;--> statement-breakpoint
DROP TABLE `suppliers`;--> statement-breakpoint
ALTER TABLE `__new_suppliers` RENAME TO `suppliers`;--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_supplier_number_unique` ON `suppliers` (`supplier_number`);--> statement-breakpoint
CREATE INDEX `idx_suppliers_group_id` ON `suppliers` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_suppliers_name` ON `suppliers` (`name`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
PRAGMA optimize;
