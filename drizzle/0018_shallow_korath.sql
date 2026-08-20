ALTER TABLE `integration_settings` ADD `sftp_pull_interval_minutes` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `integration_settings` ADD `sftp_csv_entity` text DEFAULT 'articles' NOT NULL;--> statement-breakpoint
ALTER TABLE `integration_settings` ADD `sftp_csv_delimiter` text DEFAULT ';' NOT NULL;--> statement-breakpoint
ALTER TABLE `integration_settings` ADD `sftp_csv_has_header` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `integration_settings` ADD `sftp_csv_file_pattern` text DEFAULT '*.csv' NOT NULL;--> statement-breakpoint
ALTER TABLE `integration_settings` ADD `sftp_csv_mapping_json` text DEFAULT '[]' NOT NULL;