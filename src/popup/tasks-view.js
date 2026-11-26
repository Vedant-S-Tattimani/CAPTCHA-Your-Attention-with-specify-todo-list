/*
 * Tasks tab, covering Specify's task features: create, edit, delete, sort, search, grid/list
 * view, a Pomodoro timer strip, and simple todos (add / tick / delete).
 *
 * Task and timer state stay owned by popup.js (other tabs use them); this module renders the tab
 * and calls back through `deps` to change them. Simple todos are owned here.
 */
(function () {
  "use strict";

  const T = globalThis.FocusTasks;
  const D = globalThis.FocusTodos;
  const P = globalThis.FocusPomodoro;
  const { KEYS } = globalThis.FocusSettings;

  const TAG_LABELS = { work: "Work", study: "Study", personal: "Personal", health: "Health", other: "Other" };
  const PRIORITY_LABELS = { high: "High", medium: "Medium", low: "Low" };
  const $ = (id) => document.getElementById(id);

  function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    node.append(...children);
    return node;
  }

  const options = (labels, selected) =>
    Object.entries(labels).map(([value, label]) => el("option", { value, textContent: label, selected: value === selected }));

  /**
   * @param {{
   *   getTasks: () => object[], saveTasks: (next: object[]) => Promise<void>,
   *   getFocusId: () => string | null, setFocusTask: (id: string | null) => Promise<void>,
   *   getSettings: () => object, saveSettings: (patch: object) => Promise<void>,
   *   getPomodoro: () => object, timer: (action: string) => Promise<void>,
   *   recordToday: (delta: object) => Promise<void>, celebrate: (origin?: Element) => void,
   *   todayKey: () => string, onError: (e: unknown) => void,
   * }} deps
   */
  function setup(deps) {
    let filter = { query: "", tag: "all" };
    let editingId = null;
    let todos = [];

    /* ---------- tasks ---------- */
    async function save(next) {
      await deps.saveTasks(next);
      render();
    }

    function onToggle(task, checkbox) {
      const becomingDone = !task.done;
      save(T.toggleTask(deps.getTasks(), task.id))
        .then(() => deps.recordToday({ tasksDone: becomingDone ? 1 : -1 }))
        .catch(deps.onError);
      if (becomingDone) deps.celebrate(checkbox);
    }

    function iconButton(className, text, label, onClick) {
      const button = el("button", { type: "button", className: `icon-btn ${className}`, textContent: text, title: label });
      button.setAttribute("aria-label", label);
      button.addEventListener("click", onClick);
      return button;
    }

    function editForm(task) {
      const title = el("input", { type: "text", value: task.title, maxLength: T.MAX_TITLE_LENGTH, className: "edit-title" });
      title.setAttribute("aria-label", "Task title");
      const tag = el("select", {}, options(TAG_LABELS, task.tag));
      tag.setAttribute("aria-label", "Tag");
      const priority = el("select", {}, options(PRIORITY_LABELS, task.priority));
      priority.setAttribute("aria-label", "Priority");
      const deadline = el("input", { type: "date", value: task.deadline || "" });
      deadline.setAttribute("aria-label", "Deadline");
      const error = el("p", { className: "error", role: "alert" });
      const cancel = el("button", { type: "button", className: "ghost", textContent: "Cancel" });
      const form = el("form", { className: "edit-form" }, [
        title,
        el("div", { className: "edit-meta" }, [tag, priority, deadline]),
        error,
        el("div", { className: "edit-actions" }, [cancel, el("button", { type: "submit", className: "primary", textContent: "Save" })]),
      ]);
      const close = () => {
        editingId = null;
        render();
      };
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const result = T.updateTask(deps.getTasks(), task.id, {
          title: title.value,
          tag: tag.value,
          priority: priority.value,
          deadline: deadline.value,
        });
        if (!result.ok) {
          error.textContent = result.error;
          return;
        }
        editingId = null;
        save(result.tasks).catch(deps.onError);
      });
      cancel.addEventListener("click", close);
      form.addEventListener("keydown", (event) => {
        if (event.key === "Escape") close();
      });
      queueMicrotask(() => title.focus());
      return form;
    }

    function taskItem(task, today) {
      const li = el("li", { className: `task${task.done ? " done" : ""}` });
      li.dataset.tag = task.tag;
      li.dataset.id = task.id;
      if (task.id === editingId) {
        li.classList.add("editing");
        li.append(editForm(task));
        return li;
      }

      const checkbox = el("input", { type: "checkbox", checked: task.done });
      checkbox.setAttribute("aria-label", `Mark "${task.title}" ${task.done ? "not done" : "done"}`);
      checkbox.addEventListener("change", () => onToggle(task, checkbox));

      const info = el("div", { className: "task-info" }, [
        el("span", { className: `pill ${task.priority}`, textContent: task.priority }),
        el("span", { textContent: TAG_LABELS[task.tag] || "Other" }),
      ]);
      if (task.deadline) {
        const overdue = T.isOverdue(task, today);
        info.append(el("span", { className: overdue ? "overdue" : "", textContent: overdue ? `Overdue ${task.deadline}` : `Due ${task.deadline}` }));
      }

      const pinned = task.id === deps.getFocusId() && !task.done;
      const focus = iconButton(`focus-btn${pinned ? " on" : ""}`, "🎯", pinned ? `Stop focusing on "${task.title}"` : `Focus on "${task.title}"`, () =>
        deps.setFocusTask(pinned ? null : task.id).then(render).catch(deps.onError)
      );
      focus.setAttribute("aria-pressed", String(pinned));
      focus.disabled = task.done;
      const edit = iconButton("edit-btn", "✎", `Edit "${task.title}"`, () => {
        editingId = task.id;
        render();
      });
      const del = iconButton("delete", "×", `Delete "${task.title}"`, () => {
        if (editingId === task.id) editingId = null;
        save(T.removeTask(deps.getTasks(), task.id)).catch(deps.onError);
      });

      li.classList.toggle("pinned", pinned);
      li.append(
        checkbox,
        el("div", { className: "task-body" }, [el("div", { className: "task-title", textContent: task.title }), info]),
        el("div", { className: "task-actions" }, [focus, edit, del])
      );
      return li;
    }

    function renderToolbar() {
      const { taskSort, taskView } = deps.getSettings();
      $("task-sort").value = taskSort;
      $("view-list").setAttribute("aria-pressed", String(taskView === "list"));
      $("view-grid").setAttribute("aria-pressed", String(taskView === "grid"));
      $("task-list").classList.toggle("grid", taskView === "grid");
    }

    function renderTasks() {
      const tasks = deps.getTasks();
      const visible = T.sortTasks(T.filterTasks(tasks, filter), deps.getSettings().taskSort);
      const today = deps.todayKey();
      $("task-list").replaceChildren(...visible.map((t) => taskItem(t, today)));
      $("task-empty").hidden = visible.length > 0;
      $("task-empty").textContent = tasks.length ? "No tasks match." : "No tasks yet. Add one above.";
      $("btn-clear-done").hidden = !tasks.some((t) => t.done);
      const open = tasks.filter((t) => !t.done).length;
      $("task-count").textContent = `${open} open · ${tasks.length - open} done`;
    }

    /* ---------- Pomodoro timer strip ---------- */
    function renderTimer() {
      const state = deps.getPomodoro();
      const strip = $("task-timer");
      strip.dataset.mode = state.mode;
      strip.classList.toggle("running", state.running);
      $("tt-mode").textContent = state.mode === "work" ? "Work" : "Break";
      $("tt-clock").textContent = P.formatClock(P.remaining(state, Date.now()));
      $("tt-toggle").textContent = state.running ? "Pause" : "Start";
      const task = T.focusTask(deps.getTasks(), deps.getFocusId());
      $("tt-task").textContent = task ? `🎯 ${task.title}` : "Pick a task with 🎯";
    }

    /* ---------- simple todos ---------- */
    async function saveTodos(next) {
      todos = next;
      renderTodos();
      await chrome.storage.local.set({ [KEYS.todos]: todos });
    }

    function todoItem(todo) {
      const checkbox = el("input", { type: "checkbox", checked: todo.done });
      checkbox.setAttribute("aria-label", `Mark "${todo.text}" ${todo.done ? "not done" : "done"}`);
      checkbox.addEventListener("change", () => saveTodos(D.toggleTodo(todos, todo.id)).catch(deps.onError));
      const del = iconButton("delete", "×", `Delete "${todo.text}"`, () => saveTodos(D.removeTodo(todos, todo.id)).catch(deps.onError));
      return el("li", { className: `todo${todo.done ? " done" : ""}` }, [
        el("label", { className: "todo-main" }, [checkbox, el("span", { className: "todo-text", textContent: todo.text })]),
        del,
      ]);
    }

    function renderTodos() {
      $("todo-list").replaceChildren(...todos.map(todoItem));
      $("todo-empty").hidden = todos.length > 0;
      $("btn-clear-todos").hidden = !todos.some((t) => t.done);
    }

    /* ---------- wiring ---------- */
    $("task-tag").replaceChildren(...options(TAG_LABELS, "work"));
    $("task-filter").replaceChildren(el("option", { value: "all", textContent: "All tags" }), ...options(TAG_LABELS));
    $("task-sort").replaceChildren(
      ...Object.entries(T.SORT_MODES).map(([value, mode]) => el("option", { value, textContent: `Sort: ${mode.label}` }))
    );

    $("task-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const result = T.addTask(deps.getTasks(), {
        title: $("task-title").value,
        tag: $("task-tag").value,
        priority: $("task-priority").value,
        deadline: $("task-deadline").value,
      });
      $("task-error").textContent = result.ok ? "" : result.error;
      if (!result.ok) return;
      $("task-title").value = "";
      $("task-deadline").value = "";
      save(result.tasks).catch(deps.onError);
      $("task-title").focus();
    });
    $("task-search").addEventListener("input", (event) => {
      filter = { ...filter, query: event.target.value };
      renderTasks();
    });
    $("task-filter").addEventListener("change", (event) => {
      filter = { ...filter, tag: event.target.value };
      renderTasks();
    });
    $("task-sort").addEventListener("change", (event) => deps.saveSettings({ taskSort: event.target.value }).then(render).catch(deps.onError));
    ["list", "grid"].forEach((view) =>
      $(`view-${view}`).addEventListener("click", () => deps.saveSettings({ taskView: view }).then(render).catch(deps.onError))
    );
    $("btn-clear-done").addEventListener("click", () => save(T.clearDone(deps.getTasks())).catch(deps.onError));
    $("tt-toggle").addEventListener("click", () => deps.timer(deps.getPomodoro().running ? "pause" : "start").catch(deps.onError));

    $("todo-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const result = D.addTodo(todos, $("todo-text").value);
      $("todo-error").textContent = result.ok ? "" : result.error;
      if (!result.ok) return;
      $("todo-text").value = "";
      saveTodos(result.todos).catch(deps.onError);
    });
    $("btn-clear-todos").addEventListener("click", () => saveTodos(D.clearDoneTodos(todos)).catch(deps.onError));

    chrome.storage.local
      .get(KEYS.todos)
      .then((data) => {
        todos = D.sanitizeTodos(data[KEYS.todos]);
        renderTodos();
      })
      .catch(deps.onError);

    function render() {
      renderToolbar();
      renderTasks();
      renderTimer();
    }

    return { render, renderTimer };
  }

  globalThis.FocusTasksView = { setup };
})();
