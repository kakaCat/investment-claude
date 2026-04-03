export type TodoStatus = 'pending' | 'in_progress' | 'completed'

export type TodoItem = {
  content: string       // imperative form ("Run tests")
  status: TodoStatus
  activeForm: string    // present continuous ("Running tests")
}

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'stopped'

export type Task = {
  id: number
  subject: string          // short title
  description?: string     // details
  activeForm?: string      // present continuous description
  status: TaskStatus
  owner?: string           // who owns this task
  blockedBy: number[]      // IDs of blocking tasks
  output?: string          // stored output (for TaskOutputTool)
  createdAt: string        // ISO timestamp
  updatedAt: string        // ISO timestamp
}
