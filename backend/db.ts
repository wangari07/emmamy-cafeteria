import Database from "better-sqlite3";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

export const isMySQL = !!process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("mysql");

let sqliteDb: any;
let mysqlPool: any;

if (isMySQL) {
  mysqlPool = mysql.createPool(process.env.DATABASE_URL!);
} else {
  sqliteDb = new Database("database.sqlite");
}

export const getDbInstance = () => {
  if (isMySQL) return process.env.DATABASE_URL;
  return sqliteDb;
};

export async function initCustomTables() {
  console.log("Initializing database tables...");
  if (isMySQL) {
    console.log("Using MySQL database.");
    try {
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          \`key\` VARCHAR(255) PRIMARY KEY,
          \`value\` TEXT
        );
      `);
      console.log("Settings table initialized.");
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255),
          action VARCHAR(255),
          details TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("Audit logs table initialized.");
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(255),
          message TEXT,
          type VARCHAR(255),
          is_read TINYINT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("Notifications table initialized.");
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS students (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255),
          class VARCHAR(255),
          parent_name VARCHAR(255),
          parent_phone VARCHAR(255),
          status VARCHAR(255) DEFAULT 'Active',
          card_id VARCHAR(255),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("Students table initialized.");
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS meal_cards (
          id VARCHAR(255) PRIMARY KEY,
          student_id VARCHAR(255),
          balance DECIMAL(10, 2) DEFAULT 0.00,
          status VARCHAR(255) DEFAULT 'Active',
          last_used DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("Meal cards table initialized.");
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS inventory (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255),
          category VARCHAR(255),
          stock DECIMAL(10, 2) DEFAULT 0.00,
          unit VARCHAR(255),
          status VARCHAR(255) DEFAULT 'In Stock',
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
      `);
      console.log("Inventory table initialized.");
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS meals_served (
          id INT AUTO_INCREMENT PRIMARY KEY,
          student_id VARCHAR(255),
          meal_type VARCHAR(255),
          served_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("Meals served table initialized.");
      
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS menu_items (
          id VARCHAR(255) PRIMARY KEY,
          day VARCHAR(255),
          meal_type VARCHAR(255),
          name VARCHAR(255),
          dietary_type VARCHAR(255),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("Menu items table initialized.");
      
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS mpesa_transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          transaction_id VARCHAR(255) UNIQUE,
          amount DECIMAL(10, 2),
          phone_number VARCHAR(255),
          sender_name VARCHAR(255),
          status VARCHAR(255) DEFAULT 'Completed',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("Mpesa transactions table initialized.");
      
      await mysqlPool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(255),
          amount DECIMAL(10, 2),
          student_id VARCHAR(255),
          item VARCHAR(255),
          status VARCHAR(255) DEFAULT 'Completed',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("Transactions table initialized.");
      
      // Add custom columns to user table if they don't exist
      try { await mysqlPool.query("ALTER TABLE user ADD COLUMN requires_password_change TINYINT DEFAULT 0"); } catch (e) {}
      try { await mysqlPool.query("ALTER TABLE user ADD COLUMN status VARCHAR(255) DEFAULT 'pending'"); } catch (e) {}
      try { await mysqlPool.query("ALTER TABLE user ADD COLUMN class_assigned VARCHAR(255)"); } catch (e) {}
      try { await mysqlPool.query("ALTER TABLE user ADD COLUMN phone VARCHAR(20)"); } catch (e) {}
      console.log("User table columns checked.");
    } catch (error) {
      console.error("MySQL initialization error:", error);
      throw error;
    }
  } else {
    console.log("Using SQLite database.");
    try {
      sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          action TEXT,
          details TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT,
          message TEXT,
          type TEXT,
          is_read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS students (
          id TEXT PRIMARY KEY,
          name TEXT,
          class TEXT,
          parent_name TEXT,
          parent_phone TEXT,
          status TEXT DEFAULT 'Active',
          card_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS meal_cards (
          id TEXT PRIMARY KEY,
          student_id TEXT,
          balance REAL DEFAULT 0.00,
          status TEXT DEFAULT 'Active',
          last_used DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS inventory (
          id TEXT PRIMARY KEY,
          name TEXT,
          category TEXT,
          stock REAL DEFAULT 0.00,
          unit TEXT,
          status TEXT DEFAULT 'In Stock',
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS meals_served (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id TEXT,
          meal_type TEXT,
          served_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          type TEXT,
          amount REAL,
          student_id TEXT,
          item TEXT,
          status TEXT DEFAULT 'Completed',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS mpesa_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transaction_id TEXT UNIQUE,
          amount REAL,
          phone_number TEXT,
          sender_name TEXT,
          status TEXT DEFAULT 'Completed',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS menu_items (
          id TEXT PRIMARY KEY,
          day TEXT,
          meal_type TEXT,
          name TEXT,
          dietary_type TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log("SQLite tables initialized.");
      
      // Add custom columns to user table if they don't exist
      try { sqliteDb.exec("ALTER TABLE user ADD COLUMN requires_password_change INTEGER DEFAULT 0"); } catch (e) {}
      try { sqliteDb.exec("ALTER TABLE user ADD COLUMN status TEXT DEFAULT 'pending'"); } catch (e) {}
      try { sqliteDb.exec("ALTER TABLE user ADD COLUMN class_assigned TEXT"); } catch (e) {}
      try { sqliteDb.exec("ALTER TABLE user ADD COLUMN phone TEXT"); } catch (e) {}
      console.log("SQLite user table columns checked.");

      // Seed initial data
      const studentsCount = sqliteDb.prepare("SELECT COUNT(*) as count FROM students").get().count;
      if (studentsCount === 0) {
        console.log("Seeding initial SQLite data...");
        sqliteDb.exec(`
          INSERT INTO students (id, name, class, parent_name, parent_phone, status) VALUES 
          ('STD-001', 'John Doe', 'Grade 10-A', 'Jane Doe', '+254712345678', 'Active'),
          ('STD-002', 'Alice Smith', 'Grade 9-B', 'Bob Smith', '+254723456789', 'Active'),
          ('STD-003', 'Michael Brown', 'Grade 11-C', 'Sarah Brown', '+254734567890', 'Inactive');

          INSERT INTO meal_cards (id, student_id, balance, status) VALUES 
          ('CARD-123', 'STD-001', 1500.00, 'Active'),
          ('CARD-456', 'STD-002', 750.00, 'Active');

          UPDATE students SET card_id = 'CARD-123' WHERE id = 'STD-001';
          UPDATE students SET card_id = 'CARD-456' WHERE id = 'STD-002';

          INSERT INTO inventory (id, name, category, stock, unit, status) VALUES 
          ('INV-001', 'Whole Milk', 'Dairy', 12, 'Gallons', 'In Stock'),
          ('INV-002', 'Chicken Breasts', 'Meat', 5, 'lbs', 'Low Stock'),
          ('INV-003', 'Apples', 'Produce', 45, 'lbs', 'In Stock');

          INSERT INTO mpesa_transactions (transaction_id, amount, phone_number, sender_name) VALUES 
          ('QWE123RTY', 1500.00, '+254712345678', 'John Doe'),
          ('UIO456PAS', 750.00, '+254723456789', 'Alice Smith'),
          ('DFG789HJK', 2000.00, '+254734567890', 'Michael Brown');
        `);
        console.log("Initial SQLite data seeded.");
      }
    } catch (error) {
      console.error("SQLite initialization error:", error);
      throw error;
    }
  }
  console.log("Database initialization complete.");
}

export async function query(sql: string, params: any[] = []) {
  if (isMySQL) {
    const [rows] = await mysqlPool.execute(sql, params);
    return rows;
  } else {
    const stmt = sqliteDb.prepare(sql);
    if (sql.trim().toUpperCase().startsWith("SELECT")) {
      return stmt.all(...params);
    } else {
      return stmt.run(...params);
    }
  }
}

export async function queryOne(sql: string, params: any[] = []) {
  if (isMySQL) {
    const [rows] = await mysqlPool.execute(sql, params) as any;
    return rows[0] || null;
  } else {
    return sqliteDb.prepare(sql).get(...params);
  }
}