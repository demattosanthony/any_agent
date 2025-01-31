ALTER TABLE "saml_configs" ALTER COLUMN "entry_point" TYPE bytea USING entry_point::bytea;--> statement-breakpoint
ALTER TABLE "saml_configs" ALTER COLUMN "issuer" TYPE bytea USING issuer::bytea;--> statement-breakpoint
ALTER TABLE "saml_configs" ALTER COLUMN "cert" TYPE bytea USING cert::bytea;