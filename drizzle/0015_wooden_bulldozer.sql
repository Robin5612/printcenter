ALTER TABLE `articles` RENAME COLUMN "name" TO "designation_1";--> statement-breakpoint
ALTER TABLE `articles` ADD `designation_2` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `articles` DROP COLUMN `tier_quantities_json`;--> statement-breakpoint
ALTER TABLE `suppliers` DROP COLUMN `lead_time_days`;--> statement-breakpoint
ALTER TABLE `suppliers` DROP COLUMN `lead_time_text`;