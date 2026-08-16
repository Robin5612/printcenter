CREATE TABLE `email_sender_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`provider` text DEFAULT 'custom' NOT NULL,
	`from_name` text NOT NULL,
	`from_email` text NOT NULL,
	`reply_to` text DEFAULT '' NOT NULL,
	`smtp_host` text NOT NULL,
	`smtp_port` integer DEFAULT 587 NOT NULL,
	`security` text DEFAULT 'starttls' NOT NULL,
	`username` text NOT NULL,
	`password_ciphertext` text,
	`active` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`last_tested_at` text,
	`last_test_status` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_email_sender_profiles_active_default` ON `email_sender_profiles` (`active`,`is_default`);