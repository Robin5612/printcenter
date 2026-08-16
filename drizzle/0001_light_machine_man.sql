CREATE TABLE `customer_employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`login` text NOT NULL,
	`password_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_employees_login_unique` ON `customer_employees` (`login`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_employees_email_unique` ON `customer_employees` (`email`);--> statement-breakpoint
CREATE INDEX `idx_customer_employees_customer_id` ON `customer_employees` (`customer_id`);--> statement-breakpoint
CREATE TABLE `document_lines` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` integer NOT NULL,
	`article_id` integer,
	`title` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	`line_total` real NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_document_lines_document_id` ON `document_lines` (`document_id`);--> statement-breakpoint
CREATE TABLE `gzd_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_gzd_templates_article_id_uploaded_at` ON `gzd_templates` (`article_id`,`uploaded_at`);--> statement-breakpoint
DROP INDEX `idx_documents_customer_id`;--> statement-breakpoint
ALTER TABLE `documents` ADD `customer_employee_id` integer REFERENCES customer_employees(id);--> statement-breakpoint
ALTER TABLE `documents` ADD `subtotal` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `markup_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `markup_amount` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `total` real DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_documents_customer_id_issued_at` ON `documents` (`customer_id`,`issued_at`);--> statement-breakpoint
CREATE INDEX `idx_documents_customer_employee_id_issued_at` ON `documents` (`customer_employee_id`,`issued_at`);--> statement-breakpoint
ALTER TABLE `articles` ADD `unit_price` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `markup_percent` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `phone` text;