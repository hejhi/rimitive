/**
 * Data Layer - IndexedDB for offline persistence
 *
 * Provides reactive data access that works offline.
 * Data is stored in IndexedDB and synced with signals.
 */

// =============================================================================
// Types
// =============================================================================

export type TodoItem = {
  id: string;
  listId: string;
  text: string;
  completed: boolean;
  createdAt: number;
};

export type TodoList = {
  id: string;
  name: string;
  color: string;
  createdAt: number;
};

export type TodoListWithStats = TodoList & {
  itemCount: number;
  completedCount: number;
  preview: string[];
};

// =============================================================================
// IndexedDB Helper
// =============================================================================

const DB_NAME = 'rimitive-todos';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('lists')) {
        const listsStore = db.createObjectStore('lists', { keyPath: 'id' });
        listsStore.createIndex('createdAt', 'createdAt');
      }

      if (!db.objectStoreNames.contains('items')) {
        const itemsStore = db.createObjectStore('items', { keyPath: 'id' });
        itemsStore.createIndex('listId', 'listId');
        itemsStore.createIndex('createdAt', 'createdAt');
      }
    };
  });

  return dbPromise;
}

/** Run a readonly operation on a store */
async function read<T>(
  storeName: string,
  op: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  const db = await openDB();
  const store = db.transaction(storeName, 'readonly').objectStore(storeName);
  const request = op(store);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Run a readwrite operation on a store */
async function write<T>(
  storeName: string,
  op: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  const db = await openDB();
  const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
  const request = op(store);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Run a multi-store readwrite transaction */
async function writeTx(
  storeNames: string[],
  op: (tx: IDBTransaction) => void
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(storeNames, 'readwrite');
  op(tx);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// =============================================================================
// List Operations
// =============================================================================

export const getLists = (): Promise<TodoList[]> =>
  read('lists', (s) => s.index('createdAt').getAll());

export const getList = (id: string): Promise<TodoList | undefined> =>
  read('lists', (s) => s.get(id));

export async function createList(
  name: string,
  color: string
): Promise<TodoList> {
  const list: TodoList = {
    id: crypto.randomUUID(),
    name,
    color,
    createdAt: Date.now(),
  };
  await write('lists', (s) => s.add(list));
  return list;
}

export async function deleteList(id: string): Promise<void> {
  const items = await getItemsByList(id);
  await writeTx(['lists', 'items'], (tx) => {
    tx.objectStore('lists').delete(id);
    const itemsStore = tx.objectStore('items');
    for (const item of items) {
      itemsStore.delete(item.id);
    }
  });
}

export async function getListsWithStats(): Promise<TodoListWithStats[]> {
  const lists = await getLists();
  const results = await Promise.all(
    lists.map(async (list) => {
      const items = await getItemsByList(list.id);
      const completed = items.filter((i) => i.completed);
      const uncompleted = items.filter((i) => !i.completed);
      return {
        ...list,
        itemCount: items.length,
        completedCount: completed.length,
        preview: uncompleted.slice(0, 3).map((i) => i.text),
      };
    })
  );
  return results;
}

// =============================================================================
// Item Operations
// =============================================================================

export async function getItemsByList(listId: string): Promise<TodoItem[]> {
  const items: TodoItem[] = await read('items', (s) =>
    s.index('listId').getAll(listId)
  );
  items.sort((a, b) => a.createdAt - b.createdAt);
  return items;
}

export async function createItem(
  listId: string,
  text: string
): Promise<TodoItem> {
  const item: TodoItem = {
    id: crypto.randomUUID(),
    listId,
    text,
    completed: false,
    createdAt: Date.now(),
  };
  await write('items', (s) => s.add(item));
  return item;
}

export async function toggleItem(id: string): Promise<void> {
  const item = await read<TodoItem>('items', (s) => s.get(id));
  item.completed = !item.completed;
  await write('items', (s) => s.put(item));
}

export const deleteItem = (id: string): Promise<void> =>
  write('items', (s) => s.delete(id));

// =============================================================================
// Seed Data (for demo)
// =============================================================================

export async function seedIfEmpty(): Promise<void> {
  const lists = await getLists();
  if (lists.length > 0) return;

  const personal = await createList('Personal', '#6366f1');
  const work = await createList('Work', '#f59e0b');
  const shopping = await createList('Shopping', '#10b981');
  const fitness = await createList('Fitness', '#ef4444');
  const learning = await createList('Learning', '#8b5cf6');
  const home = await createList('Home', '#06b6d4');

  const done = async (listId: string, text: string) => {
    const item = await createItem(listId, text);
    await toggleItem(item.id);
  };

  await createItem(personal.id, 'Learn Rimitive');
  await done(personal.id, 'Set up dev environment');
  await createItem(personal.id, 'Build a PWA');
  await createItem(personal.id, 'Try offline mode');
  await done(personal.id, 'Read signals docs');

  await createItem(work.id, 'Review pull requests');
  await createItem(work.id, 'Update documentation');
  await done(work.id, 'Fix CI pipeline');
  await createItem(work.id, 'Write migration guide');
  await createItem(work.id, 'Plan Q2 roadmap');
  await done(work.id, 'Deploy v2.1');

  await createItem(shopping.id, 'Milk');
  await createItem(shopping.id, 'Bread');
  await createItem(shopping.id, 'Coffee');
  await done(shopping.id, 'Eggs');
  await createItem(shopping.id, 'Olive oil');
  await done(shopping.id, 'Pasta');

  await createItem(fitness.id, 'Morning run');
  await createItem(fitness.id, 'Stretch routine');
  await done(fitness.id, 'Sign up for gym');
  await createItem(fitness.id, 'Meal prep Sunday');

  await done(learning.id, 'Finish TypeScript handbook');
  await createItem(learning.id, 'Build a side project');
  await createItem(learning.id, 'Read "Designing Data-Intensive Apps"');
  await createItem(learning.id, 'Practice algorithms');
  await done(learning.id, 'Watch Signals talk');

  await createItem(home.id, 'Fix leaky faucet');
  await done(home.id, 'Organize garage');
  await createItem(home.id, 'Replace air filter');
  await createItem(home.id, 'Paint bedroom');
  await done(home.id, 'Clean gutters');
}
