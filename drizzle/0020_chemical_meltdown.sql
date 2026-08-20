ALTER TABLE `workflow_settings` ADD `customer_password_reset_subject` text DEFAULT 'Passwort für Ihr Printcenter-Kundenportal zurücksetzen' NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `customer_password_reset_template` text DEFAULT 'Guten Tag {salutation} {lastName},

über den folgenden Link können Sie Ihr Passwort für das Kundenportal von {company} neu setzen:

{resetUrl}

Der Link ist {expiresIn} gültig und kann nur einmal verwendet werden. Falls Sie diese Änderung nicht angefordert haben, können Sie diese E-Mail ignorieren.

Freundliche Grüsse
Printcenter' NOT NULL;