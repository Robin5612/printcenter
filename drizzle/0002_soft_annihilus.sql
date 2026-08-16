CREATE TABLE `backend_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'operator' NOT NULL,
	`password_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `backend_users_email_unique` ON `backend_users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_backend_users_active` ON `backend_users` (`active`);