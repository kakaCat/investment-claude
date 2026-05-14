export const DESCRIPTION = `Retrieve output from a running or completed task (background shell, agent, or remote session)

DEPRECATED: Background tasks return their output file path in the tool result, and you receive a <task-notification> with the same path when the task completes.
- For bash tasks: prefer using the Read tool on that output file path — it contains stdout/stderr.
- For local_agent tasks: use the Agent tool result directly. Do NOT Read the .output file — it is a symlink to the full sub-agent conversation transcript (JSONL) and will overflow your context window.
- For remote_agent tasks: prefer using the Read tool on the output file path — it contains the streamed remote session output (same as bash).

## Parameters

- **task_id**: The task ID to get output from
- **block**: Whether to wait for task completion (default: true)
- **timeout**: Max wait time in milliseconds (default: 30000, max: 600000)

## Usage

- Takes a task_id parameter identifying the task
- Returns the task output along with status information
- Use block=true (default) to wait for task completion
- Use block=false for non-blocking check of current status
- Task IDs can be found using the /tasks command
- Works with all task types: background shells, async agents, and remote sessions`

export const SEARCH_HINT = 'task output result read'
