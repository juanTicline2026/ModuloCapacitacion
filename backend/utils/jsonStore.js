const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Read a JSON file from the data directory.
 * Returns parsed data or a default value if file doesn't exist.
 * @param {string} filename - Name of the JSON file (e.g., 'capacitaciones.json')
 * @param {*} defaultValue - Default value if file doesn't exist
 * @returns {*} Parsed JSON data
 */
function read(filename, defaultValue = []) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (!fs.existsSync(filePath)) {
      write(filename, defaultValue);
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Error reading ${filename}:`, error.message);
    return defaultValue;
  }
}

/**
 * Write data to a JSON file in the data directory.
 * @param {string} filename - Name of the JSON file
 * @param {*} data - Data to serialize and write
 */
function write(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing ${filename}:`, error.message);
    throw new Error(`Failed to write data to ${filename}`);
  }
}

module.exports = { read, write };
