import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'bookshelf-files-db'
const STORE_NAME = 'files'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

export async function saveBookFile(id: string, file: File): Promise<void> {
  try {
    const db = await getDb()
    await db.put(STORE_NAME, file, id)
  } catch (err) {
    console.warn('Failed to persist book file to IndexedDB:', err)
  }
}

export async function getBookFile(id: string): Promise<File | undefined> {
  try {
    const db = await getDb()
    return await db.get(STORE_NAME, id)
  } catch (err) {
    console.warn('Failed to read book file from IndexedDB:', err)
    return undefined
  }
}

export async function deleteBookFile(id: string): Promise<void> {
  try {
    const db = await getDb()
    await db.delete(STORE_NAME, id)
  } catch (err) {
    console.warn('Failed to delete book file from IndexedDB:', err)
  }
}
