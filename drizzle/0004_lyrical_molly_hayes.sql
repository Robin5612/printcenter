CREATE TABLE `workflow_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_template` text NOT NULL,
	`supplier_offer_subject` text NOT NULL,
	`offer_email` text NOT NULL,
	`order_email` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `project_id` integer;--> statement-breakpoint
ALTER TABLE `documents` ADD `supplier_token` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `supplier_gzd_key` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `pdf_object_key` text;