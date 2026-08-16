ALTER TABLE `workflow_settings` ADD `offer_template` text NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `order_template` text NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `confirmation_template` text NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `attach_request_document` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `attach_request_gzd` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `attach_offer_document` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `attach_offer_gzd` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `attach_order_document` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `attach_order_gzd` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `attach_confirmation_document` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `attach_confirmation_gzd` integer DEFAULT true NOT NULL;