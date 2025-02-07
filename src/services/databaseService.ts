export class DatabaseService {
  private static instance: DatabaseService;
  private db: IDBDatabase | null = null;
  private dbInitPromise: Promise<void> | null = null;
  
  public static readonly DB_NAME = 'amen_db';
  public static readonly DB_VERSION = 3;
  public static readonly STORES = {
    VIDEOS: 'videos',
    PROJECTS: 'projects'
  };

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  static async clearDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(DatabaseService.DB_NAME);
      
      deleteRequest.onerror = () => {
        console.error('Error deleting database:', deleteRequest.error);
        reject(deleteRequest.error);
      };
      
      deleteRequest.onsuccess = () => {
        console.log('Database deleted successfully');
        resolve();
      };
    });
  }

  async initializeDB(): Promise<void> {
    if (this.dbInitPromise) {
      return this.dbInitPromise;
    }

    this.dbInitPromise = new Promise((resolve, reject) => {
      this.openDatabase(resolve, reject);
    });

    return this.dbInitPromise;
  }

  private openDatabase(resolve: () => void, reject: (error: any) => void): void {
    const request = indexedDB.open(DatabaseService.DB_NAME, DatabaseService.DB_VERSION);

    request.onerror = () => {
      console.error('Error opening database:', request.error);
      this.dbInitPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      this.db = request.result;
      
      // Gérer la fermeture de la base de données
      this.db.onclose = () => {
        console.log('Database connection closed');
        this.db = null;
        this.dbInitPromise = null;
      };
      
      this.db.onerror = (event) => {
        console.error('Database error:', event);
      };
      
      console.log('Database initialized successfully');
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Créer les object stores s'ils n'existent pas
      if (!db.objectStoreNames.contains(DatabaseService.STORES.PROJECTS)) {
        console.log('Creating projects object store');
        db.createObjectStore(DatabaseService.STORES.PROJECTS, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(DatabaseService.STORES.VIDEOS)) {
        console.log('Creating videos object store');
        db.createObjectStore(DatabaseService.STORES.VIDEOS, { keyPath: 'id' });
      }
    };
  }

  async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initializeDB();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }
}
