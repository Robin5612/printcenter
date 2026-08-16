CREATE TABLE `integration_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`navision_endpoint` text DEFAULT '' NOT NULL,
	`navision_tenant` text DEFAULT '' NOT NULL,
	`api_base_url` text DEFAULT '' NOT NULL,
	`api_client_id` text DEFAULT '' NOT NULL,
	`ftp_protocol` text DEFAULT 'SFTP' NOT NULL,
	`ftp_host` text DEFAULT '' NOT NULL,
	`ftp_port` text DEFAULT '22' NOT NULL,
	`ftp_username` text DEFAULT '' NOT NULL,
	`ftp_directory` text DEFAULT '/printcenter' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
