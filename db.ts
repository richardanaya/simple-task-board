import Database from 'better-sqlite3';

export type ColumnName = 'idea' | 'approved idea' | 'working on' | 'blocked' | 'ready for review' | 'done';

export interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  column_name: ColumnName;
  dependencies?: string[];
}

export interface Transition {
  id: number;
  task_id: string;
  from_column: string | null;
  to_column: ColumnName;
  timestamp: string;
}

const db: Database.Database = new Database('simple-task-board.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    assignee TEXT,
    column_name TEXT NOT NULL CHECK (column_name IN ('idea', 'approved idea', 'working on', 'blocked', 'ready for review', 'done'))
  );

  CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id INTEGER NOT NULL,
    depends_on_id INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (depends_on_id) REFERENCES tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_id)
  );

  CREATE TABLE IF NOT EXISTS task_transitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    from_column TEXT,
    to_column TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);

export default db;