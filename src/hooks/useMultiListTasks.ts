import { useState, useEffect, useCallback } from 'react';
import type { Task, TaskList, ListVisibility, ListCollapsed, TasksByList } from '../types';
import * as api from '../api/client';

export function useMultiListTasks() {
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [tasksByList, setTasksByList] = useState<TasksByList>({});
  const [listVisibility, setListVisibility] = useState<ListVisibility>({});
  const [listCollapsed, setListCollapsed] = useState<ListCollapsed>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all task lists
  const fetchTaskLists = useCallback(async () => {
    try {
      const lists = await api.getTaskLists();
      setTaskLists(lists);

      // Initialize visibility (all visible by default)
      const visibility: ListVisibility = {};
      lists.forEach((list) => {
        visibility[list.id] = true;
      });
      setListVisibility(visibility);

      return lists;
    } catch (err) {
      console.error('Failed to fetch task lists:', err);
      return [];
    }
  }, []);

  // Fetch tasks for all lists in parallel
  const fetchAllTasks = useCallback(async (lists: TaskList[], silent = false, initCollapsed = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      const results = await Promise.all(
        lists.map(async (list) => {
          const tasks = await api.getTasks(list.id);
          return { listId: list.id, tasks };
        })
      );

      const newTasksByList: TasksByList = {};
      results.forEach(({ listId, tasks }) => {
        newTasksByList[listId] = tasks;
      });
      setTasksByList(newTasksByList);

      // Initialize collapsed state based on task count (only on first load)
      if (initCollapsed) {
        const collapsed: ListCollapsed = {};
        results.forEach(({ listId, tasks }) => {
          // Collapse lists with no active tasks
          const activeTasks = tasks.filter(t => t.status !== 'completed');
          collapsed[listId] = activeTasks.length === 0;
        });
        setListCollapsed(collapsed);
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      const lists = await fetchTaskLists();
      if (lists.length > 0) {
        await fetchAllTasks(lists, false, true); // initCollapsed = true
      } else {
        setLoading(false);
      }
    };
    init();
  }, [fetchTaskLists, fetchAllTasks]);

  // Polling every 60 seconds
  useEffect(() => {
    if (taskLists.length === 0) return;

    const interval = setInterval(() => {
      fetchAllTasks(taskLists, true);
    }, 60000);

    return () => clearInterval(interval);
  }, [taskLists, fetchAllTasks]);

  // Toggle list visibility
  const toggleListVisibility = useCallback((listId: string) => {
    setListVisibility((prev) => ({
      ...prev,
      [listId]: !prev[listId],
    }));
  }, []);

  // Toggle list collapsed state
  const toggleListCollapsed = useCallback((listId: string) => {
    setListCollapsed((prev) => ({
      ...prev,
      [listId]: !prev[listId],
    }));
  }, []);

  // Create a new task list
  const createList = useCallback(async (title: string) => {
    const newList = await api.createTaskList(title);
    setTaskLists((prev) => [...prev, newList]);
    setTasksByList((prev) => ({ ...prev, [newList.id]: [] }));
    setListVisibility((prev) => ({ ...prev, [newList.id]: true }));
    setListCollapsed((prev) => ({ ...prev, [newList.id]: false }));
    return newList;
  }, []);

  // Delete a task list
  const deleteList = useCallback(async (listId: string) => {
    await api.deleteTaskList(listId);
    setTaskLists((prev) => prev.filter((l) => l.id !== listId));
    setTasksByList((prev) => {
      const next = { ...prev };
      delete next[listId];
      return next;
    });
    setListVisibility((prev) => {
      const next = { ...prev };
      delete next[listId];
      return next;
    });
    setListCollapsed((prev) => {
      const next = { ...prev };
      delete next[listId];
      return next;
    });
  }, []);

  // Get visible lists
  const visibleLists = taskLists.filter((list) => listVisibility[list.id]);

  // Add task to a specific list
  const addTask = useCallback(
    async (title: string, options?: { notes?: string; due?: string; listId?: string }) => {
      const listId = options?.listId || taskLists[0]?.id;
      if (!listId) throw new Error('No task list available');

      const newTask = await api.createTask(title, { ...options, listId });
      setTasksByList((prev) => ({
        ...prev,
        [listId]: [newTask, ...(prev[listId] || [])],
      }));
      return newTask;
    },
    [taskLists]
  );

  // Toggle complete for a task
  const toggleComplete = useCallback(
    async (taskId: string, completed: boolean, listId: string) => {
      const updater = completed ? api.uncompleteTask : api.completeTask;
      const updated = await updater(taskId, listId);
      setTasksByList((prev) => ({
        ...prev,
        [listId]: prev[listId].map((t) => (t.id === taskId ? updated : t)),
      }));
      return updated;
    },
    []
  );

  // Update a task
  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Pick<Task, 'title' | 'notes' | 'due'>>, listId: string) => {
      const updated = await api.updateTask(taskId, updates, listId);
      setTasksByList((prev) => ({
        ...prev,
        [listId]: prev[listId].map((t) => (t.id === taskId ? updated : t)),
      }));
      return updated;
    },
    []
  );

  // Remove a task
  const removeTask = useCallback(
    async (taskId: string, listId: string) => {
      await api.deleteTask(taskId, listId);
      setTasksByList((prev) => ({
        ...prev,
        [listId]: prev[listId].filter((t) => t.id !== taskId),
      }));
    },
    []
  );

  // Refresh all tasks
  const refresh = useCallback(() => {
    if (taskLists.length > 0) {
      fetchAllTasks(taskLists);
    }
  }, [taskLists, fetchAllTasks]);

  // Get all tasks (for calendar view)
  const allTasks = Object.values(tasksByList).flat();

  return {
    taskLists,
    tasksByList,
    listVisibility,
    listCollapsed,
    visibleLists,
    allTasks,
    loading,
    error,
    toggleListVisibility,
    toggleListCollapsed,
    createList,
    deleteList,
    addTask,
    toggleComplete,
    updateTask,
    removeTask,
    refresh,
  };
}
