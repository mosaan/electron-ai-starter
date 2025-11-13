CREATE INDEX `idx_chat_messages_session_sequence` ON `chat_messages` (`session_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_session_created` ON `chat_messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_message_parts_message_sequence` ON `message_parts` (`message_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `idx_message_parts_session_kind` ON `message_parts` (`session_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_message_parts_tool_call_id` ON `message_parts` (`tool_call_id`);--> statement-breakpoint
CREATE INDEX `idx_session_snapshots_kind` ON `session_snapshots` (`session_id`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_tool_invocations_tool_name` ON `tool_invocations` (`tool_name`);--> statement-breakpoint
CREATE INDEX `idx_tool_invocations_status_completed` ON `tool_invocations` (`status`,`completed_at`);--> statement-breakpoint
CREATE INDEX `idx_tool_invocations_session_created` ON `tool_invocations` (`session_id`,`created_at`);