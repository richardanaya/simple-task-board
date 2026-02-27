"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = startServer;
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("./db"));
// HTML escaping to prevent XSS
function esc(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
const COLUMNS = ['idea', 'approved idea', 'working on', 'blocked', 'ready for review', 'done'];
// Cohesive color system using a single warm-cool spectrum.
// All text colors are chosen for >= 4.5:1 contrast on their backgrounds (WCAG AA).
// Accents are muted and used only for thin borders/indicators, never as text-on-white.
const COLUMN_THEME = {
    'idea': { tint: '#eef2ff', accent: '#818cf8', textOnTint: '#3730a3', label: 'Idea' },
    'approved idea': { tint: '#ecfdf5', accent: '#6ee7b7', textOnTint: '#065f46', label: 'Approved' },
    'working on': { tint: '#fefce8', accent: '#fcd34d', textOnTint: '#713f12', label: 'In Progress' },
    'blocked': { tint: '#fef2f2', accent: '#fca5a5', textOnTint: '#991b1b', label: 'Blocked' },
    'ready for review': { tint: '#f5f3ff', accent: '#c4b5fd', textOnTint: '#5b21b6', label: 'Review' },
    'done': { tint: '#f0fdfa', accent: '#5eead4', textOnTint: '#115e59', label: 'Done' },
};
function startServer(port = 3000, host = 'localhost') {
    const app = (0, express_1.default)();
    app.use(express_1.default.urlencoded({ extended: true }));
    app.use(express_1.default.json());
    // ── Main page ──────────────────────────────────────────────────────
    app.get('/', (_req, res) => {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#ffffff">
  <title>Task Board</title>
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    /* ── Reset ─────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Design tokens ─────────────────────────────────────── */
    :root {
      --c-bg:        #f9fafb;
      --c-surface:   #ffffff;
      --c-text:      #111827;
      --c-text-sec:  #4b5563;   /* 7:1 on white */
      --c-text-tri:  #6b7280;   /* 5.7:1 on white */
      --c-border:    #e5e7eb;
      --c-border-lt: #f3f4f6;
      --c-focus:     #6366f1;

      --r-lg: 14px;
      --r-md: 10px;
      --r-sm: 6px;

      --shadow-1: 0 1px 2px 0 rgb(0 0 0 / .05);
      --shadow-2: 0 1px 3px 0 rgb(0 0 0 / .1), 0 1px 2px -1px rgb(0 0 0 / .1);
      --shadow-3: 0 4px 6px -1px rgb(0 0 0 / .1), 0 2px 4px -2px rgb(0 0 0 / .1);
      --shadow-up: 0 -4px 16px rgb(0 0 0 / .12);

      --ease: cubic-bezier(.4, 0, .2, 1);
      --dur: 150ms;

      --safe-b: env(safe-area-inset-bottom, 0px);
    }

    /* ── Base ───────────────────────────────────────────────── */
    html { height: 100%; -webkit-text-size-adjust: 100%; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 15px;
      line-height: 1.5;
      color: var(--c-text);
      background: var(--c-bg);
      min-height: 100%;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Header ────────────────────────────────────────────── */
    .hdr {
      position: sticky; top: 0; z-index: 20;
      background: var(--c-surface);
      border-bottom: 1px solid var(--c-border);
      padding: 0 20px;
      height: 56px;
      display: flex; align-items: center; justify-content: center;
    }
    .hdr h1 {
      font-size: 17px; font-weight: 700; letter-spacing: -.01em;
      color: var(--c-text);
    }

    /* ── Board (horizontal scroll, mobile-first) ───────────── */
    .board-scroll {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scroll-snap-type: x mandatory;
      scroll-padding: 16px;
      padding: 20px 16px;
    }
    /* Hide scrollbar but keep scrolling */
    .board-scroll::-webkit-scrollbar { display: none; }
    .board-scroll { -ms-overflow-style: none; scrollbar-width: none; }

    .board {
      display: inline-flex;
      gap: 14px;
      min-width: 100%;
    }

    /* ── Column ────────────────────────────────────────────── */
    .col {
      flex: 0 0 280px;
      scroll-snap-align: start;
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: var(--r-lg);
      display: flex; flex-direction: column;
      max-height: calc(100vh - 100px);
      max-height: calc(100dvh - 100px);
      box-shadow: var(--shadow-1);
    }
    .col-hd {
      padding: 14px 16px;
      display: flex; align-items: center; gap: 10px;
      border-bottom: 1px solid var(--c-border);
      flex-shrink: 0;
    }
    .col-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .col-name {
      flex: 1;
      font-size: 13px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .04em;
      color: var(--c-text);
    }
    .col-cnt {
      font-size: 12px; font-weight: 600;
      min-width: 22px; text-align: center;
      padding: 1px 7px; border-radius: 999px;
      line-height: 1.5;
    }
    .col-body {
      flex: 1; overflow-y: auto;
      padding: 10px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .col-body::-webkit-scrollbar { width: 4px; }
    .col-body::-webkit-scrollbar-thumb { background: var(--c-border); border-radius: 4px; }

    /* ── Task card ──────────────────────────────────────────── */
    .card {
      background: var(--c-surface);
      border: 1px solid var(--c-border);
      border-radius: var(--r-md);
      padding: 14px;
      box-shadow: var(--shadow-1);
      transition: box-shadow var(--dur) var(--ease);
    }
    .card:hover { box-shadow: var(--shadow-2); }
    .card-title {
      font-size: 14px; font-weight: 600; color: var(--c-text);
      line-height: 1.35; margin-bottom: 4px;
    }
    .card-desc {
      font-size: 13px; color: var(--c-text-sec);
      line-height: 1.5; margin-bottom: 8px;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    .card-tags {
      display: flex; flex-wrap: wrap; gap: 5px;
      margin-bottom: 10px;
    }
    .tag {
      font-size: 11px; font-weight: 500; line-height: 1;
      padding: 4px 8px; border-radius: 999px;
    }
    .tag-person {
      background: #eef2ff; color: #3730a3;  /* 8.3:1 */
    }
    .tag-dep {
      background: #fef3c7; color: #78350f;  /* 7.5:1 */
    }
    .card-actions {
      display: flex; align-items: center; gap: 6px;
    }

    /* ── Shared control styles ─────────────────────────────── */
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      font-family: inherit; font-size: 13px; font-weight: 500;
      line-height: 1; white-space: nowrap;
      padding: 8px 14px; border-radius: var(--r-sm);
      border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text-sec);
      cursor: pointer;
      transition: background var(--dur) var(--ease), border-color var(--dur) var(--ease), color var(--dur) var(--ease);
      -webkit-tap-highlight-color: transparent;
    }
    .btn:hover  { background: var(--c-border-lt); color: var(--c-text); }
    .btn:active { background: var(--c-border); }
    .btn:focus-visible { outline: 2px solid var(--c-focus); outline-offset: 2px; }

    .btn-primary {
      background: var(--c-focus); border-color: var(--c-focus); color: #fff;
    }
    .btn-primary:hover { background: #4f46e5; border-color: #4f46e5; color: #fff; }

    .btn-del {
      color: #b91c1c; border-color: #fecaca; background: #fef2f2;
    }
    .btn-del:hover { background: #fee2e2; border-color: #f87171; }

    .btn-add-task {
      width: 100%; margin-top: auto; flex-shrink: 0;
      padding: 10px; font-size: 13px; font-weight: 500;
      border: 1.5px dashed var(--c-border); border-radius: var(--r-md);
      background: transparent; color: var(--c-text-tri);
      cursor: pointer; font-family: inherit;
      transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease), background var(--dur) var(--ease);
      -webkit-tap-highlight-color: transparent;
    }
    .btn-add-task:hover {
      border-color: var(--c-focus); color: var(--c-focus); background: #eef2ff;
    }

    .sel {
      font-family: inherit; font-size: 12px; font-weight: 500;
      padding: 6px 8px; border-radius: var(--r-sm);
      border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text-sec);
      cursor: pointer; flex: 1; min-width: 0; max-width: 120px;
      -webkit-tap-highlight-color: transparent;
      transition: border-color var(--dur) var(--ease);
    }
    .sel:focus { outline: none; border-color: var(--c-focus); box-shadow: 0 0 0 3px rgb(99 102 241 / .15); }

    /* ── Empty state ───────────────────────────────────────── */
    .empty {
      text-align: center; padding: 28px 8px;
      font-size: 13px; color: var(--c-text-tri);
    }

    /* ── Modal / Bottom sheet ──────────────────────────────── */
    .overlay {
      position: fixed; inset: 0; z-index: 100;
      background: rgb(17 24 39 / .45);
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      animation: fadeIn 120ms var(--ease);
    }
    .sheet {
      background: var(--c-surface);
      border-radius: var(--r-lg);
      width: 100%; max-width: 440px;
      max-height: 88vh; overflow-y: auto;
      box-shadow: var(--shadow-3);
      animation: slideUp 180ms var(--ease);
    }
    .sheet-hd {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 20px 0;
    }
    .sheet-hd h2 { font-size: 17px; font-weight: 700; color: var(--c-text); }
    .sheet-close {
      width: 36px; height: 36px;
      display: flex; align-items: center; justify-content: center;
      border: none; background: none; color: var(--c-text-tri);
      cursor: pointer; border-radius: var(--r-sm); font-size: 20px;
      transition: background var(--dur) var(--ease), color var(--dur) var(--ease);
      -webkit-tap-highlight-color: transparent;
    }
    .sheet-close:hover { background: var(--c-border-lt); color: var(--c-text); }
    .sheet-body { padding: 16px 20px 24px; }

    /* drag handle for mobile bottom sheet */
    .sheet-handle {
      display: none;
      width: 36px; height: 4px;
      background: var(--c-border);
      border-radius: 4px;
      margin: 10px auto 0;
    }

    /* ── Form ──────────────────────────────────────────────── */
    .fg { margin-bottom: 14px; }
    .fg:last-of-type { margin-bottom: 18px; }
    .fl {
      display: block; font-size: 13px; font-weight: 600; color: var(--c-text);
      margin-bottom: 5px;
    }
    .fi, .ft {
      display: block; width: 100%;
      font-family: inherit; font-size: 15px; line-height: 1.5;
      padding: 10px 12px; border-radius: var(--r-md);
      border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text);
      transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease);
    }
    .fi:focus, .ft:focus {
      outline: none; border-color: var(--c-focus);
      box-shadow: 0 0 0 3px rgb(99 102 241 / .15);
    }
    .fi::placeholder, .ft::placeholder { color: #9ca3af; } /* 3.5:1 on white – fine for placeholder */
    .ft { resize: vertical; min-height: 76px; }
    .f-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .f-actions .btn { padding: 10px 20px; font-size: 14px; }

    /* ── Feedback messages ──────────────────────────────────── */
    .msg {
      padding: 14px 18px; border-radius: var(--r-md);
      font-size: 14px; font-weight: 500; text-align: center;
    }
    .msg-ok  { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
    .msg-err { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

    /* ── Animations ─────────────────────────────────────────── */
    @keyframes fadeIn  { from { opacity: 0 } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(10px) } }

    /* ── Desktop (>=960) ───────────────────────────────────── */
    @media (min-width: 960px) {
      .board-scroll { padding: 24px; overflow-x: visible; scroll-snap-type: none; }
      .board {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        min-width: 0;
      }
      .col { flex: 1; min-width: 0; }
    }
    @media (min-width: 1400px) {
      .board-scroll { padding: 24px 40px; }
    }

    /* ── Mobile (<=600) ────────────────────────────────────── */
    @media (max-width: 600px) {
      .hdr { height: 50px; padding: 0 16px; }
      .hdr h1 { font-size: 16px; }
      .board-scroll { padding: 14px 12px; }
      .col { flex: 0 0 85vw; max-height: calc(100dvh - 84px); }

      /* Bottom sheet on mobile */
      .overlay {
        align-items: flex-end;
        padding: 0;
      }
      .sheet {
        max-width: 100%;
        border-radius: var(--r-lg) var(--r-lg) 0 0;
        max-height: 92vh;
        padding-bottom: var(--safe-b);
      }
      .sheet-handle { display: block; }
      .sheet-hd { padding: 8px 20px 0; }
      .sheet-body { padding: 12px 20px calc(20px + var(--safe-b)); }

      .card-actions { flex-wrap: wrap; }
      .sel { max-width: none; flex: 1 1 100%; }
    }
  </style>
</head>
<body>
  <header class="hdr"><h1>Task Board</h1></header>
  <div class="board-scroll">
    <div id="board" hx-get="/board" hx-trigger="load, refresh from:body">
    </div>
  </div>
  <div id="modal"></div>
  <script>
    function closeModal() {
      document.getElementById('modal').innerHTML = '';
    }
    document.addEventListener('click', function(e) {
      if (e.target && e.target.classList.contains('overlay')) closeModal();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });
  </script>
</body>
</html>`;
        res.send(html);
    });
    // ── Board HTML fragment ──────────────────────────────────────────
    app.get('/board', (_req, res) => {
        const tasks = db_1.default.prepare('SELECT * FROM tasks').all();
        const deps = db_1.default.prepare('SELECT task_id, depends_on_id FROM task_dependencies').all();
        const depMap = {};
        deps.forEach(d => {
            if (!depMap[d.task_id])
                depMap[d.task_id] = [];
            depMap[d.task_id].push(d.depends_on_id);
        });
        let html = '<div class="board">';
        COLUMNS.forEach(col => {
            const ct = tasks.filter(t => t.column_name === col);
            const th = COLUMN_THEME[col];
            html += `<div class="col">
        <div class="col-hd">
          <span class="col-dot" style="background:${th.accent}"></span>
          <span class="col-name">${esc(th.label)}</span>
          <span class="col-cnt" style="background:${th.tint};color:${th.textOnTint}">${ct.length}</span>
        </div>
        <div class="col-body" style="background:${th.tint}">`;
            if (ct.length === 0) {
                html += '<div class="empty">No tasks</div>';
            }
            ct.forEach(task => {
                const taskDeps = depMap[task.id] || [];
                html += `<div class="card" id="task-${esc(task.id)}">
          <div class="card-title">${esc(task.title)}</div>`;
                if (task.description) {
                    html += `<div class="card-desc">${esc(task.description)}</div>`;
                }
                const hasMeta = task.assignee || taskDeps.length > 0;
                if (hasMeta) {
                    html += '<div class="card-tags">';
                    if (task.assignee)
                        html += `<span class="tag tag-person">${esc(task.assignee)}</span>`;
                    taskDeps.forEach(d => { html += `<span class="tag tag-dep">${esc(d)}</span>`; });
                    html += '</div>';
                }
                html += `<div class="card-actions">
            <button class="btn" hx-get="/edit/${encodeURIComponent(task.id)}" hx-target="#modal" hx-swap="innerHTML">Edit</button>
            <button class="btn btn-del" hx-delete="/task/${encodeURIComponent(task.id)}" hx-confirm="Delete this task?">Del</button>
            <select class="sel" name="column" hx-put="/move/${encodeURIComponent(task.id)}">
              ${COLUMNS.map(c => `<option value="${c}"${c === col ? ' selected' : ''}>${esc(COLUMN_THEME[c].label)}</option>`).join('')}
            </select>
          </div>
        </div>`;
            });
            html += `<button class="btn-add-task" hx-get="/add-form/${encodeURIComponent(col)}" hx-target="#modal" hx-swap="innerHTML">+ Add task</button>
        </div>
      </div>`;
        });
        html += '</div>';
        res.send(html);
    });
    // ── Add task form (modal) ────────────────────────────────────────
    app.get('/add-form/:column', (req, res) => {
        const column = req.params.column;
        const th = COLUMN_THEME[column] || COLUMN_THEME['idea'];
        res.send(`
      <div class="overlay">
        <div class="sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-hd">
            <h2>New task &mdash; ${esc(th.label)}</h2>
            <button class="sheet-close" onclick="closeModal()" aria-label="Close">&times;</button>
          </div>
          <div class="sheet-body">
            <form hx-post="/task" hx-target="#modal" hx-swap="innerHTML">
              <input type="hidden" name="column" value="${esc(column)}">
              <div class="fg">
                <label class="fl">ID</label>
                <input class="fi" name="id" required placeholder="unique-task-id" autocomplete="off">
              </div>
              <div class="fg">
                <label class="fl">Title</label>
                <input class="fi" name="title" required placeholder="What needs to be done?">
              </div>
              <div class="fg">
                <label class="fl">Description</label>
                <textarea class="ft" name="description" placeholder="Optional details..."></textarea>
              </div>
              <div class="fg">
                <label class="fl">Assignee</label>
                <input class="fi" name="assignee" placeholder="Who is responsible?">
              </div>
              <div class="fg">
                <label class="fl">Dependencies</label>
                <input class="fi" name="dependencies" placeholder="task-1, task-2">
              </div>
              <div class="f-actions">
                <button type="button" class="btn" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Add Task</button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
    });
    // ── Create task ──────────────────────────────────────────────────
    app.post('/task', (req, res) => {
        const { id, title, description, assignee, column, dependencies } = req.body;
        try {
            db_1.default.prepare('INSERT INTO tasks (id, title, description, assignee, column_name) VALUES (?, ?, ?, ?, ?)')
                .run(id, title, description || '', assignee || '', column);
            db_1.default.prepare('INSERT INTO task_transitions (task_id, from_column, to_column) VALUES (?, ?, ?)')
                .run(id, null, column);
            if (dependencies) {
                const list = dependencies.split(',').map((d) => d.trim()).filter((d) => d);
                const ins = db_1.default.prepare('INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)');
                list.forEach((dep) => ins.run(id, dep));
            }
            res.set('HX-Trigger', 'refresh');
            res.send(`
        <div class="overlay">
          <div class="sheet"><div class="sheet-body">
            <div class="msg msg-ok">Task added</div>
          </div></div>
        </div>
        <script>setTimeout(closeModal, 700)</script>`);
        }
        catch (err) {
            res.send(`
        <div class="overlay">
          <div class="sheet">
            <div class="sheet-hd"><h2>Error</h2><button class="sheet-close" onclick="closeModal()" aria-label="Close">&times;</button></div>
            <div class="sheet-body"><div class="msg msg-err">${esc(err.message)}</div></div>
          </div>
        </div>`);
        }
    });
    // ── Edit task form (modal) ───────────────────────────────────────
    app.get('/edit/:id', (req, res) => {
        const id = req.params.id;
        const task = db_1.default.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
        if (!task) {
            return res.send(`
        <div class="overlay"><div class="sheet">
          <div class="sheet-hd"><h2>Error</h2><button class="sheet-close" onclick="closeModal()" aria-label="Close">&times;</button></div>
          <div class="sheet-body"><div class="msg msg-err">Task not found</div></div>
        </div></div>`);
        }
        const depStr = db_1.default.prepare('SELECT depends_on_id FROM task_dependencies WHERE task_id = ?')
            .all(id).map((d) => d.depends_on_id).join(', ');
        res.send(`
      <div class="overlay">
        <div class="sheet">
          <div class="sheet-handle"></div>
          <div class="sheet-hd">
            <h2>Edit task</h2>
            <button class="sheet-close" onclick="closeModal()" aria-label="Close">&times;</button>
          </div>
          <div class="sheet-body">
            <form hx-put="/task/${encodeURIComponent(id)}" hx-target="#modal" hx-swap="innerHTML">
              <div class="fg"><label class="fl">Title</label><input class="fi" name="title" value="${esc(task.title)}"></div>
              <div class="fg"><label class="fl">Description</label><textarea class="ft" name="description">${esc(task.description)}</textarea></div>
              <div class="fg"><label class="fl">Assignee</label><input class="fi" name="assignee" value="${esc(task.assignee || '')}"></div>
              <div class="fg"><label class="fl">Dependencies</label><input class="fi" name="dependencies" value="${esc(depStr)}"></div>
              <div class="f-actions">
                <button type="button" class="btn" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      </div>`);
    });
    // ── Update task ──────────────────────────────────────────────────
    app.put('/task/:id', (req, res) => {
        const id = req.params.id;
        const { title, description, assignee, dependencies } = req.body;
        try {
            db_1.default.prepare('UPDATE tasks SET title = ?, description = ?, assignee = ? WHERE id = ?')
                .run(title, description, assignee, id);
            db_1.default.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(id);
            if (dependencies) {
                const list = dependencies.split(',').map((d) => d.trim()).filter((d) => d);
                const ins = db_1.default.prepare('INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)');
                list.forEach((dep) => ins.run(id, dep));
            }
            res.set('HX-Trigger', 'refresh');
            res.send(`
        <div class="overlay">
          <div class="sheet"><div class="sheet-body">
            <div class="msg msg-ok">Task updated</div>
          </div></div>
        </div>
        <script>setTimeout(closeModal, 700)</script>`);
        }
        catch (err) {
            res.send(`
        <div class="overlay">
          <div class="sheet">
            <div class="sheet-hd"><h2>Error</h2><button class="sheet-close" onclick="closeModal()" aria-label="Close">&times;</button></div>
            <div class="sheet-body"><div class="msg msg-err">${esc(err.message)}</div></div>
          </div>
        </div>`);
        }
    });
    // ── Delete task ──────────────────────────────────────────────────
    app.delete('/task/:id', (req, res) => {
        try {
            db_1.default.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(req.params.id);
            db_1.default.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
            res.set('HX-Trigger', 'refresh');
            res.send('');
        }
        catch (_) {
            res.status(500).send('');
        }
    });
    // ── Move task ────────────────────────────────────────────────────
    app.put('/move/:id', (req, res) => {
        const id = req.params.id;
        const { column } = req.body;
        try {
            const task = db_1.default.prepare('SELECT column_name FROM tasks WHERE id = ?').get(id);
            if (!task)
                return res.status(404).send('');
            if (task.column_name === column)
                return res.send('');
            db_1.default.prepare('INSERT INTO task_transitions (task_id, from_column, to_column) VALUES (?, ?, ?)')
                .run(id, task.column_name, column);
            db_1.default.prepare('UPDATE tasks SET column_name = ? WHERE id = ?').run(column, id);
            res.set('HX-Trigger', 'refresh');
            res.send('');
        }
        catch (_) {
            res.status(500).send('');
        }
    });
    app.listen(port, host, () => {
        console.log(`Server running at http://${host}:${port}`);
    });
}
