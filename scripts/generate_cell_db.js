const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const dbPath = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'cell_towers_india.db');

// Ensure parent dir exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Remove old file if exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE cell_towers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mcc INTEGER NOT NULL,
    mnc INTEGER NOT NULL,
    lac INTEGER NOT NULL,
    cid INTEGER NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    range REAL DEFAULT 1500
  );
  CREATE INDEX idx_cell ON cell_towers(mcc, mnc, lac, cid);
`);

const insertStmt = db.prepare(`
  INSERT INTO cell_towers (mcc, mnc, lac, cid, lat, lon, range)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Realistic cell towers for major pilgrimage routes, remote tourist hubs, and trial benchmarks
// India MCC = 404 & 405 (Jio, Airtel, Vi, BSNL)
const sampleTowers = [
  // Kedarnath Temple & Trek Circuit (Uttarakhand)
  { mcc: 404, mnc: 45, lac: 1024, cid: 54101, lat: 30.7346, lon: 79.0669, range: 800 },   // Kedarnath Shrine
  { mcc: 405, mnc: 854, lac: 1024, cid: 54102, lat: 30.7350, lon: 79.0675, range: 750 },  // Kedarnath Helipad
  { mcc: 404, mnc: 45, lac: 1024, cid: 54103, lat: 30.6441, lon: 79.0305, range: 1200 },  // Gaurikund Base Camp
  { mcc: 405, mnc: 866, lac: 1024, cid: 54104, lat: 30.5512, lon: 79.0833, range: 1500 }, // Guptkashi
  { mcc: 404, mnc: 20, lac: 1024, cid: 54105, lat: 30.6923, lon: 79.0511, range: 1000 },  // Lincholi Rest Stop
  { mcc: 404, mnc: 45, lac: 1024, cid: 54106, lat: 30.7104, lon: 79.0588, range: 900 },   // Jungle Chatti

  // Badrinath & Valley of Flowers (Uttarakhand)
  { mcc: 404, mnc: 45, lac: 1030, cid: 54201, lat: 30.7433, lon: 79.4938, range: 900 },   // Badrinath Town
  { mcc: 405, mnc: 854, lac: 1030, cid: 54202, lat: 30.6720, lon: 79.5815, range: 1800 },  // Ghangaria (Valley of Flowers base)
  { mcc: 404, mnc: 10, lac: 1030, cid: 54203, lat: 30.5574, lon: 79.5630, range: 1400 },  // Joshimath

  // Rishikesh & Haridwar (Ganges tourist corridor)
  { mcc: 404, mnc: 45, lac: 1010, cid: 51101, lat: 30.0869, lon: 78.2676, range: 1100 },  // Rishikesh Laxman Jhula
  { mcc: 405, mnc: 854, lac: 1010, cid: 51102, lat: 30.1342, lon: 78.3242, range: 1300 },  // Shivpuri Rafting Camps
  { mcc: 404, mnc: 45, lac: 1010, cid: 51201, lat: 29.9457, lon: 78.1642, range: 1000 },  // Har Ki Pauri, Haridwar

  // Himachal Pradesh (Manali - Rohtang - Spiti)
  { mcc: 404, mnc: 45, lac: 2010, cid: 62101, lat: 32.2396, lon: 77.1887, range: 1200 },  // Old Manali
  { mcc: 405, mnc: 854, lac: 2010, cid: 62102, lat: 32.3716, lon: 77.2466, range: 2500 },  // Solang Valley
  { mcc: 404, mnc: 20, lac: 2010, cid: 62103, lat: 32.3721, lon: 77.2289, range: 2000 },  // Atal Tunnel South Portal
  { mcc: 404, mnc: 45, lac: 2020, cid: 62201, lat: 32.2461, lon: 78.0349, range: 3000 },  // Kaza, Spiti Valley

  // Ladakh (Leh & Pangong)
  { mcc: 404, mnc: 45, lac: 3010, cid: 71101, lat: 34.1526, lon: 77.5771, range: 1500 },  // Leh Main Bazaar
  { mcc: 405, mnc: 854, lac: 3010, cid: 71102, lat: 34.2787, lon: 77.6047, range: 3500 },  // Khardung La Pass
  { mcc: 404, mnc: 45, lac: 3020, cid: 71201, lat: 33.7595, lon: 78.4385, range: 4000 },  // Pangong Tso (Lukung)

  // Goa & Coastal Circuit
  { mcc: 404, mnc: 45, lac: 4010, cid: 81101, lat: 15.5494, lon: 73.7535, range: 900 },   // Calangute Beach
  { mcc: 405, mnc: 854, lac: 4010, cid: 81102, lat: 15.0110, lon: 74.0232, range: 1200 },  // Palolem Beach

  // Test / Simulator Fallback Cells (Used for mock testing on emulators)
  { mcc: 404, mnc: 1, lac: 1, cid: 1, lat: 28.6139, lon: 77.2090, range: 1000 },          // New Delhi Central
  { mcc: 310, mnc: 260, lac: 100, cid: 1001, lat: 30.7346, lon: 79.0669, range: 1000 }    // Android Emulator generic (T-Mobile MCC 310)
];

for (const t of sampleTowers) {
  insertStmt.run(t.mcc, t.mnc, t.lac, t.cid, t.lat, t.lon, t.range);
}

db.close();
console.log(`Successfully generated ${sampleTowers.length} cell towers in ${dbPath}`);
