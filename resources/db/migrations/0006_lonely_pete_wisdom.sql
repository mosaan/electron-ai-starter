CREATE TABLE `model_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`max_input_tokens` integer NOT NULL,
	`max_output_tokens` integer NOT NULL,
	`default_compression_threshold` real DEFAULT 0.95 NOT NULL,
	`recommended_retention_tokens` integer DEFAULT 1000 NOT NULL,
	`source` text NOT NULL,
	`last_updated` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_model_configs_provider` ON `model_configs` (`provider`);