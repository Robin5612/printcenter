CREATE TABLE `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`customer_id` integer,
	`supplier_id` integer,
	`supplier_group_id` integer,
	`stock` integer DEFAULT 0 NOT NULL,
	`reorder_point` integer DEFAULT 0 NOT NULL,
	`print_file_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_group_id`) REFERENCES `supplier_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_sku_unique` ON `articles` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_articles_customer_id` ON `articles` (`customer_id`);--> statement-breakpoint
CREATE INDEX `idx_articles_supplier_id` ON `articles` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `customer_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_id` integer NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_accounts_email_unique` ON `customer_accounts` (`email`);--> statement-breakpoint
CREATE INDEX `idx_customer_accounts_customer_id` ON `customer_accounts` (`customer_id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_number` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`email` text,
	`city` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_customer_number_unique` ON `customers` (`customer_number`);--> statement-breakpoint
CREATE INDEX `idx_customers_name` ON `customers` (`name`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_number` text NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`customer_id` integer,
	`supplier_id` integer,
	`issued_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_document_number_unique` ON `documents` (`document_number`);--> statement-breakpoint
CREATE INDEX `idx_documents_type_status` ON `documents` (`type`,`status`);--> statement-breakpoint
CREATE INDEX `idx_documents_customer_id` ON `documents` (`customer_id`);--> statement-breakpoint
CREATE TABLE `navision_sync_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`direction` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`external_reference` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_navision_sync_log_status_created_at` ON `navision_sync_log` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `supplier_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_groups_name_unique` ON `supplier_groups` (`name`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`supplier_number` text NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`email` text,
	`lead_time_days` integer,
	`group_id` integer,
	FOREIGN KEY (`group_id`) REFERENCES `supplier_groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppliers_supplier_number_unique` ON `suppliers` (`supplier_number`);--> statement-breakpoint
CREATE INDEX `idx_suppliers_group_id` ON `suppliers` (`group_id`);--> statement-breakpoint
CREATE INDEX `idx_suppliers_name` ON `suppliers` (`name`);