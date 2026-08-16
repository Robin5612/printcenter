ALTER TABLE `workflow_settings` ADD `backend_password_reset_subject` text DEFAULT 'Passwort für Printcenter zurücksetzen' NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `backend_password_reset_template` text DEFAULT 'Guten Tag {name},

über den folgenden Link können Sie Ihr Passwort für das Printcenter-Backend neu setzen:

{resetUrl}

Der Link ist {expiresIn} gültig und kann nur einmal verwendet werden. Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.

Freundliche Grüsse
Printcenter' NOT NULL;