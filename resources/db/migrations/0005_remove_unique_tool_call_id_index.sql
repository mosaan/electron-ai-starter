-- Remove unique index on tool_call_id to allow multiple parts (tool_invocation and tool_result) to share the same toolCallId
DROP INDEX IF EXISTS `idx_message_parts_tool_call_id`;
