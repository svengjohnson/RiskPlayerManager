const Database = require('better-sqlite3');
const db = new Database('./risk-player-manager.sqlite');

db.exec(`
  CREATE TABLE IF NOT EXISTS seen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    deviceId TEXT,
    userId TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    deviceId TEXT,
    userId TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS blacklist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    deviceId TEXT,
    userId TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS currentLobby (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    deviceId TEXT,
    userId TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS linkedDevices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId1 TEXT,
    deviceId2 TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(deviceId1, deviceId2)
  );  

  CREATE TABLE IF NOT EXISTS linkedUsers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId1 TEXT,
    userId2 TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(userId1, userId2) 
  );
`);

module.exports = {
    addToCurrentLobby: (name, deviceId, userId,) => {
        const stmt = db.prepare(`
      INSERT INTO currentLobby (name, deviceId, userId) 
      VALUES (?, ?, ?)
    `);
        stmt.run(name, deviceId, userId);
    },

    inCurrentLobby: (deviceId, userId) => {
        const rows = db.prepare(`
      SELECT * FROM currentLobby WHERE deviceId = ? AND userId = ?
    `).all(deviceId, userId);
        return rows.length > 0;
    },

    resetCurrentLobby: () => {
        db.prepare('DELETE FROM currentLobby').run();
    },

    getCurrentLobby: () => {
        return db.prepare('SELECT * FROM currentLobby').all();
    },

    removeFromLobby: (userId) => {
        db.prepare('DELETE FROM currentLobby WHERE userId = ?').run(userId);
    },

    playerSeen: (name, deviceId, userId) => {
        const stmt = db.prepare(`
      INSERT INTO seen (name, deviceId, userId,) 
      VALUES (?, ?, ?)
    `);
        stmt.run(name, deviceId, userId);
    },

    whiteListPlayer: (name, deviceId, userId) => {
        db.prepare('DELETE FROM blacklist WHERE deviceId = ? OR userId = ?').run(deviceId, userId);
        db.prepare(`
      INSERT INTO whitelist (name, deviceId, userId) 
      VALUES (?, ?, ?)
    `).run(name, deviceId, userId);
    },

    removeFromWhiteList: (deviceId, userId) => {
        db.prepare('DELETE FROM whitelist WHERE deviceId = ? OR userId = ?').run(deviceId, userId);
    },

    blacklistPlayer: (name, deviceId, userId) => {
        db.prepare('DELETE FROM whitelist WHERE deviceId = ? OR userId = ?').run(deviceId, userId);
        db.prepare(`
      INSERT INTO blacklist (name, deviceId, userId) 
      VALUES (?, ?, ?)
    `).run(name, deviceId, userId);
    },

    removeFromBlacklist: (deviceId, userId) => {
        db.prepare('DELETE FROM blacklist WHERE deviceId = ? OR userId = ?').run(deviceId, userId);
    },

    whitelistedAt: (deviceId, userId) => {
        const row = db.prepare(`
      SELECT * FROM whitelist WHERE deviceId = ? OR userId = ?
    `).get(deviceId, userId);
        return row ? row.timestamp : false
    },

    blacklistedAt: (deviceId, userId) => {
        const row = db.prepare(`
      SELECT * FROM blacklist WHERE deviceId = ? OR userId = ?
    `).get(deviceId, userId);
        return row ? row.timestamp : false;
    },

    getSeen: (deviceId, userId) => {
        return db.prepare(`SELECT * FROM seen WHERE deviceId = ? OR userId = ?`).all(deviceId, userId);
    },

    getSeenWithLinked: (deviceId, userId) => {
        return db.prepare(`SELECT * FROM seen WHERE 
                       deviceId = ? OR 
                       deviceId IN(SELECT deviceId2 FROM linkedDevices where deviceId1 = ?) OR 
                       userId = ? OR 
                       userId IN(SELECT userId2 from linkedUsers where userId1 = ?)
                       ORDER BY timestamp DESC`)
            .all(deviceId, deviceId, userId, userId);
    },

    getSeenByDeviceId: (deviceId) => {
        return db.prepare(`SELECT * FROM seen WHERE deviceId = ? ORDER BY timestamp DESC`).all(deviceId);
    },

    getSeenByUserId: (userId) => {
        return db.prepare(`SELECT * FROM seen WHERE userId = ? ORDER BY timestamp DESC`).all(userId);
    },

    linkDevices: (deviceId1, deviceId2) => {
        db.prepare(`
      INSERT OR IGNORE INTO linkedDevices (deviceId1, deviceId2) 
      VALUES (?, ?)
    `).run(deviceId1, deviceId2);
        db.prepare(`
      INSERT OR IGNORE INTO linkedDevices (deviceId1, deviceId2) 
      VALUES (?, ?)
    `).run(deviceId2, deviceId1);
    },

    linkUsers: (userId1, userId2) => {
        db.prepare(`
      INSERT OR IGNORE INTO linkedUsers (userId1, userId2) 
      VALUES (?, ?)
    `).run(userId1, userId2);
        db.prepare(`
      INSERT OR IGNORE INTO linkedUsers (userId1, userId2) 
      VALUES (?, ?)
    `).run(userId2, userId1);
    },
};