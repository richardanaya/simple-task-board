#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const db_1 = __importDefault(require("./db"));
const program = new commander_1.Command();
// Prepared statements
const insertTask = db_1.default.prepare(`
  INSERT INTO tasks (id, title, description, assignee, column_name)
  VALUES (?, ?, ?, ?, ?)
`);
const updateTask = db_1.default.prepare(`
  UPDATE tasks SET title = ?, description = ?, assignee = ?, column_name = ?
  WHERE id = ?
`);
const deleteTask = db_1.default.prepare('DELETE FROM tasks WHERE id = ?');
const insertDependency = db_1.default.prepare(`
  INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id)
  VALUES (?, ?)
`);
const deleteDependencies = db_1.default.prepare('DELETE FROM task_dependencies WHERE task_id = ?');
const updateAssignee = db_1.default.prepare('UPDATE tasks SET assignee = ? WHERE id = ?');
const insertTransition = db_1.default.prepare('INSERT INTO task_transitions (task_id, from_column, to_column) VALUES (?, ?, ?)');
const deleteDependency = db_1.default.prepare('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?');
const getTransitions = db_1.default.prepare('SELECT * FROM task_transitions WHERE task_id = ? ORDER BY timestamp');
const getAllTransitions = db_1.default.prepare('SELECT * FROM task_transitions ORDER BY timestamp');
const getAllTasks = db_1.default.prepare('SELECT * FROM tasks');
const getTaskById = db_1.default.prepare('SELECT * FROM tasks WHERE id = ?');
const getDependencies = db_1.default.prepare('SELECT depends_on_id FROM task_dependencies WHERE task_id = ?');
// Helper to get task with dependencies
function getTaskWithDeps(taskId) {
    const task = getTaskById.get(taskId);
    if (!task)
        return null;
    const deps = getDependencies.all(taskId).map((row) => row.depends_on_id);
    return { ...task, dependencies: deps };
}
// Commands
program
    .name('task-board')
    .description('A CLI tool for managing a task board with columns, dependencies, and transition tracking. Supports CRUD operations on tasks, searching, assigning, and viewing statistics.')
    .version('1.0.0')
    .addHelpText('after', `
Available Columns: idea, approved idea, working on, blocked, ready for review, done

Primary Workflows for AI Agents:
- Task Lifecycle: Create (add), view (list/show), modify (update/move), complete (move to 'done'), delete
- Assignment Management: Assign tasks (assign), reassign (update -a), unassign, view my tasks (my-tasks)
- Dependency Handling: Add/remove dependencies (dependency add/remove or update --dependencies)
- Progress Tracking: Move between columns (move), view history (history), analyze time in columns (transition-stats)
- Searching & Reporting: Find tasks (search), get column counts (stats)
Examples:
  task-board add -i "task1" -t "Implement feature" -c "idea"
  task-board move "task1" "working on"
  task-board my-tasks "AI Agent" "working on"  # Recent tasks assigned to me in a column
  task-board dependency add "task2" "task1"
  task-board search -c "blocked"
  task-board transition-stats
`);
// Add task
program
    .command('add')
    .description('Create a new task with ID, title, optional description, assignee, column, and dependencies. Records initial transition to the column.')
    .requiredOption('-i, --id <id>', 'Task ID (string, required)')
    .requiredOption('-t, --title <title>', 'Task title (string, required)')
    .option('-d, --description <desc>', 'Task description in markdown format (string, optional)')
    .option('-a, --assignee <assignee>', 'Assignee name (string, optional)')
    .requiredOption('-c, --column <column>', 'Initial column: idea, approved idea, working on, blocked, ready for review, done (string, required)')
    .option('--dependencies <deps>', 'Comma-separated list of task IDs this task depends on (e.g., "task1,task2") (string, optional)')
    .action((options) => {
    try {
        insertTask.run(options.id, options.title, options.description || '', options.assignee || '', options.column);
        insertTransition.run(options.id, null, options.column);
        if (options.dependencies) {
            for (const depId of options.dependencies) {
                insertDependency.run(options.id, depId);
            }
        }
        console.log(`Task added with ID: ${options.id}`);
    }
    catch (err) {
        console.error('Error adding task:', err.message);
    }
});
// List tasks
program
    .command('list')
    .description('Display a table of all tasks with their details, including dependencies.')
    .action(() => {
    const tasks = getAllTasks.all().map((task) => {
        const deps = getDependencies.all(task.id).map((row) => row.depends_on_id);
        return { ...task, dependencies: deps };
    });
    console.table(tasks);
});
// Show task
program
    .command('show <id>')
    .description('Display detailed information for a single task by ID, including dependencies.')
    .action((id) => {
    const task = getTaskWithDeps(id);
    if (task) {
        console.log(task);
    }
    else {
        console.error('Task not found');
    }
});
// Update task
program
    .command('update <id>')
    .description('Update an existing task by ID. Specify only the fields to change. Records transition if column changes.')
    .option('-t, --title <title>', 'New title (string)')
    .option('-d, --description <desc>', 'New description in markdown (string)')
    .option('-a, --assignee <assignee>', 'New assignee name (string)')
    .option('-c, --column <column>', 'New column: idea, approved idea, working on, blocked, ready for review, done (string)')
    .option('--dependencies <deps>', 'Comma-separated list of dependency task IDs to replace existing ones (e.g., "1,2") (string)')
    .action((id, options) => {
    try {
        const task = getTaskById.get(id);
        if (!task) {
            console.error('Task not found');
            return;
        }
        const newTitle = options.title || task.title;
        const newDesc = options.description !== undefined ? options.description : task.description;
        const newAssignee = options.assignee !== undefined ? options.assignee : task.assignee;
        const newColumn = options.column || task.column_name;
        if (options.column && options.column !== task.column_name) {
            insertTransition.run(id, task.column_name, options.column);
        }
        updateTask.run(newTitle, newDesc, newAssignee, newColumn, id);
        if (options.dependencies !== undefined) {
            deleteDependencies.run(id);
            for (const depId of options.dependencies) {
                insertDependency.run(id, depId);
            }
        }
        console.log('Task updated');
    }
    catch (err) {
        console.error('Error updating task:', err.message);
    }
});
// Delete task
program
    .command('delete <id>')
    .description('Delete a task by ID, including all its dependencies and transition history.')
    .action((id) => {
    try {
        deleteDependencies.run(id);
        const result = deleteTask.run(id);
        if (result.changes > 0) {
            console.log('Task deleted');
        }
        else {
            console.error('Task not found');
        }
    }
    catch (err) {
        console.error('Error deleting task:', err.message);
    }
});
// Search tasks
program
    .command('search')
    .description('Search for tasks matching any of the specified criteria (title prefix, column, assignee). Displays matching tasks with dependencies.')
    .option('-t, --title <prefix>', 'Search for tasks whose title starts with this prefix (string)')
    .option('-c, --column <column>', 'Filter by exact column name (string)')
    .option('-a, --assignee <assignee>', 'Filter by exact assignee name (string)')
    .action((options) => {
    try {
        let query = 'SELECT * FROM tasks WHERE 1=1';
        const params = [];
        if (options.title) {
            query += ' AND title LIKE ?';
            params.push(`${options.title}%`);
        }
        if (options.column) {
            query += ' AND column_name = ?';
            params.push(options.column);
        }
        if (options.assignee) {
            query += ' AND assignee = ?';
            params.push(options.assignee);
        }
        const stmt = db_1.default.prepare(query);
        const tasks = stmt.all(...params);
        const results = tasks.map(task => {
            const deps = getDependencies.all(task.id).map((row) => row.depends_on_id);
            return { ...task, dependencies: deps };
        });
        if (results.length > 0) {
            console.table(results);
        }
        else {
            console.log('No tasks found matching the criteria.');
        }
    }
    catch (err) {
        console.error('Error searching tasks:', err.message);
    }
});
// Assign task
program
    .command('assign <id> <assignee>')
    .description('Assign a task to a specific assignee by updating the assignee field.')
    .action((id, assignee) => {
    try {
        const result = updateAssignee.run(assignee, id);
        if (result.changes > 0) {
            console.log(`Task ${id} assigned to ${assignee}`);
        }
        else {
            console.error('Task not found');
        }
    }
    catch (err) {
        console.error('Error assigning task:', err.message);
    }
});
// Stats
program
    .command('stats')
    .description('Display the count of tasks currently in each column.')
    .action(() => {
    try {
        const columns = ['idea', 'approved idea', 'working on', 'blocked', 'ready for review', 'done'];
        const stats = {};
        for (const col of columns) {
            const stmt = db_1.default.prepare('SELECT COUNT(*) as count FROM tasks WHERE column_name = ?');
            const result = stmt.get(col);
            stats[col] = result.count;
        }
        console.log('Task Statistics:');
        for (const col of columns) {
            console.log(`${col}: ${stats[col]}`);
        }
    }
    catch (err) {
        console.error('Error getting stats:', err.message);
    }
});
// History
program
    .command('history <id>')
    .description('Display the transition history (column changes with timestamps) for a specific task by ID.')
    .action((id) => {
    try {
        const transitions = getTransitions.all(id);
        if (transitions.length > 0) {
            console.table(transitions);
        }
        else {
            console.log('No transitions found for this task.');
        }
    }
    catch (err) {
        console.error('Error getting history:', err.message);
    }
});
// Transition Stats
program
    .command('transition-stats')
    .description('Calculate and display average time spent in each column based on transition history, including ongoing tasks.')
    .action(() => {
    try {
        const columns = ['idea', 'approved idea', 'working on', 'blocked', 'ready for review', 'done'];
        const columnTimes = {};
        for (const col of columns) {
            columnTimes[col] = [];
        }
        // Get all tasks
        const tasks = getAllTasks.all();
        const now = new Date().getTime();
        for (const task of tasks) {
            const transitions = getTransitions.all(task.id);
            if (transitions.length === 0)
                continue;
            // Sort transitions by timestamp
            transitions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            let prevTime = new Date(transitions[0].timestamp).getTime();
            let prevColumn = transitions[0].to_column;
            for (let i = 1; i < transitions.length; i++) {
                const trans = transitions[i];
                const time = new Date(trans.timestamp).getTime();
                const duration = time - prevTime;
                if (columnTimes[prevColumn]) {
                    columnTimes[prevColumn].push(duration);
                }
                prevTime = time;
                prevColumn = trans.to_column;
            }
            // From last transition to now, if not done
            if (task.column_name !== 'done') {
                const duration = now - prevTime;
                if (columnTimes[prevColumn]) {
                    columnTimes[prevColumn].push(duration);
                }
            }
        }
        console.log('Transition Statistics (Average time in ms):');
        for (const col of columns) {
            const times = columnTimes[col];
            if (times.length > 0) {
                const avg = times.reduce((a, b) => a + b, 0) / times.length;
                console.log(`${col}: ${Math.round(avg)} ms (${times.length} instances)`);
            }
            else {
                console.log(`${col}: No data`);
            }
        }
    }
    catch (err) {
        console.error('Error getting transition stats:', err.message);
    }
});
// Move
program
    .command('move <id> <column>')
    .description('Move a task to a new column and record the transition. Validates column name and checks if task exists.')
    .action((id, column) => {
    try {
        const validColumns = ['idea', 'approved idea', 'working on', 'blocked', 'ready for review', 'done'];
        if (!validColumns.includes(column)) {
            console.error('Invalid column. Valid columns: idea, approved idea, working on, blocked, ready for review, done');
            return;
        }
        const task = getTaskById.get(id);
        if (!task) {
            console.error('Task not found');
            return;
        }
        if (task.column_name === column) {
            console.log('Task is already in that column');
            return;
        }
        insertTransition.run(id, task.column_name, column);
        updateTask.run(task.title, task.description, task.assignee, column, id);
        console.log(`Task ${id} moved to "${column}"`);
    }
    catch (err) {
        console.error('Error moving task:', err.message);
    }
});
// Dependency subcommands
const dependencyCmd = program
    .command('dependency')
    .description('Manage task dependencies: add or remove specific dependencies without affecting others.');
dependencyCmd
    .command('add <taskId> <depId>')
    .description('Add a dependency: make task <taskId> depend on <depId>. Validates that both tasks exist.')
    .action((taskId, depId) => {
    try {
        const task = getTaskById.get(taskId);
        const depTask = getTaskById.get(depId);
        if (!task) {
            console.error('Task not found');
            return;
        }
        if (!depTask) {
            console.error('Dependency task not found');
            return;
        }
        insertDependency.run(taskId, depId);
        console.log(`Dependency added: Task ${taskId} depends on ${depId}`);
    }
    catch (err) {
        console.error('Error adding dependency:', err.message);
    }
});
dependencyCmd
    .command('remove <taskId> <depId>')
    .description('Remove a specific dependency: remove <depId> from the dependencies of <taskId>.')
    .action((taskId, depId) => {
    try {
        const result = deleteDependency.run(taskId, depId);
        if (result.changes > 0) {
            console.log(`Dependency removed: Task ${taskId} no longer depends on ${depId}`);
        }
        else {
            console.error('Dependency not found');
        }
    }
    catch (err) {
        console.error('Error removing dependency:', err.message);
    }
});
// Unassign
program
    .command('unassign <id>')
    .description('Remove the assignee from a task by setting the assignee field to null.')
    .action((id) => {
    try {
        const result = updateAssignee.run(null, id);
        if (result.changes > 0) {
            console.log(`Task ${id} unassigned`);
        }
        else {
            console.error('Task not found');
        }
    }
    catch (err) {
        console.error('Error unassigning task:', err.message);
    }
});
// My Tasks
program
    .command('my-tasks <assignee> [column]')
    .description('Show tasks assigned to a specific user, optionally filtered by column. Sorted by task ID (recent first).')
    .action((assignee, column) => {
    try {
        let query = 'SELECT * FROM tasks WHERE assignee = ?';
        const params = [assignee];
        if (column) {
            const validColumns = ['idea', 'approved idea', 'working on', 'blocked', 'ready for review', 'done'];
            if (!validColumns.includes(column)) {
                console.error('Invalid column. Valid columns: idea, approved idea, working on, blocked, ready for review, done');
                return;
            }
            query += ' AND column_name = ?';
            params.push(column);
        }
        query += ' ORDER BY id DESC';
        const stmt = db_1.default.prepare(query);
        const tasks = stmt.all(...params);
        const results = tasks.map(task => {
            const deps = getDependencies.all(task.id).map((row) => row.depends_on_id);
            return { ...task, dependencies: deps };
        });
        if (results.length > 0) {
            console.table(results);
        }
        else {
            console.log('No tasks found for this assignee' + (column ? ` in column "${column}"` : ''));
        }
    }
    catch (err) {
        console.error('Error fetching my tasks:', err.message);
    }
});
// Serve
program
    .command('serve')
    .description('Start a web server to view and manage the task board using an HTMX-powered web interface with Pico.css styling.')
    .option('-p, --port <port>', 'Port to run the server on', '7788')
    .option('-h, --host <host>', 'Host to bind the server to', 'localhost')
    .action((options) => {
    const { startServer } = require('./server');
    startServer(parseInt(options.port), options.host);
});
program.parse();
