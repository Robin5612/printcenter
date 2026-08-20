ALTER TABLE `workflow_settings` ADD `reorder_point_subject` text DEFAULT 'Meldebestand erreicht: {sku} · {article}' NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `reorder_point_template` text DEFAULT 'Guten Tag {customer},

der Meldebestand für den Artikel {sku} · {article} wurde erreicht.

Aktueller Bestand: {stock} Stück
Meldebestand: {minimum} Stück

Bitte prüfen Sie eine Nachbestellung.

Freundliche Grüsse
Printcenter' NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `request_recipient` text DEFAULT 'supplier' NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `offer_recipient` text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `order_recipient` text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `confirmation_recipient` text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `reorder_point_recipient` text DEFAULT 'customer' NOT NULL;