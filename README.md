# Simple Task Board

[![npm version](https://badge.fury.io/js/simple-task-board.svg)](https://badge.fury.io/js/simple-task-board)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A command-line tool for managing a task board with columns, dependencies, and transition tracking. Built with TypeScript and SQLite.

## Features

- **Task Management**: Create, update, delete, and view tasks with custom string IDs.
- **Columns**: Organize tasks into stages: idea, approved idea, working on, blocked, ready for review, done.
- **Dependencies**: Link tasks with dependencies for complex workflows.
- **Transition Tracking**: Automatically log column changes with timestamps.
- **Assignment**: Assign tasks to users and filter by assignee.
- **Reporting**: View statistics, history, and transition analytics.

## Installation

```bash
npm install -g simple-task-board
```

## Usage

After installation, use the `simple-task-board` command.

### Getting Started

```bash
# Add a new task
simple-task-board add -i "task1" -t "Implement feature" -c "idea"

# List all tasks
simple-task-board list

# Move a task to another column
simple-task-board move "task1" "working on"

# View help
simple-task-board --help
```

### Available Commands

#### Task Operations
- `add [options]`: Create a new task
- `list`: Display all tasks
- `show <id>`: Show details of a specific task
- `update [options] <id>`: Update a task
- `delete <id>`: Delete a task

#### Assignment & Filtering
- `assign <id> <assignee>`: Assign a task
- `unassign <id>`: Remove assignee
- `my-tasks <assignee> [column]`: Show tasks assigned to a user

#### Dependencies
- `dependency add <taskId> <depId>`: Add dependency
- `dependency remove <taskId> <depId>`: Remove dependency

#### Movement & Tracking
- `move <id> <column>`: Move task to column
- `history <id>`: View transition history
- `transition-stats`: Show time spent in columns

#### Search & Stats
- `search [options]`: Search tasks by title, column, or assignee
- `stats`: Show task counts per column

## Database

- Uses `simple-task-board.db` (SQLite) in the current directory.
- Tables: `tasks`, `task_dependencies`, `task_transitions`.

## Development

```bash
git clone git@github.com:richardanaya/simple-task-board.git
cd simple-task-board
npm install
npm run build
npm link
```

## License

MIT - See [LICENSE](LICENSE) file.

## Author

Richard Anaya