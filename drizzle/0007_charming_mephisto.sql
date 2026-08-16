ALTER TABLE `customer_employees` ADD `mail_to_main` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `street` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `postal_code` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `country` text DEFAULT 'Schweiz' NOT NULL;