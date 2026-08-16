ALTER TABLE `workflow_settings` ADD `employee_login_subject` text DEFAULT 'Ihr Zugang zum Printcenter von {company}' NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_settings` ADD `employee_login_template` text DEFAULT 'Guten Tag {salutation} {lastName},

Ihr persönlicher Zugang zum Kundenportal von {company} ist eingerichtet.

Portal: {portalUrl}
Login: {email}
Passwort: {password}

Bitte bewahren Sie diese Zugangsdaten sicher auf.

Freundliche Grüsse
Printcenter' NOT NULL;