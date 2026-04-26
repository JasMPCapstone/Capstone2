const path = require('path');
const fs = require('fs');

const SPA_INDEX = path.join(__dirname, '..', 'client', 'dist', 'index.html');

function hasSpa() {
  return fs.existsSync(SPA_INDEX);
}

function sendSpa(res) {
  return res.sendFile(SPA_INDEX);
}

/** Use for GET routes that previously rendered EJS. */
function sendSpaOr503(res) {
  if (!hasSpa()) {
    return res
      .status(503)
      .type('text')
      .send('Client app is not built. From the project root run: npm run build:client');
  }
  return sendSpa(res);
}

module.exports = { SPA_INDEX, hasSpa, sendSpa, sendSpaOr503 };
