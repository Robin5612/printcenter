ALTER TABLE `articles` ADD `tier_quantities_json` text DEFAULT '[100,250,500,1000,2000]' NOT NULL;--> statement-breakpoint
ALTER TABLE `articles` ADD `stock_history_json` text DEFAULT '[]' NOT NULL;