const winston = require('winston');
const { createLogger, format, transports } = winston;
 
// Ensure the correct import for format
const { combine, printf, timestamp } = format || winston.format;
 
// Define log format
const logFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});
 
const createCustomLogger = (label) => {
  return createLogger({
    format: combine(
      winston.format.label({ label }), // <-- Use winston.format.label function here
      timestamp(),
      logFormat
    ),
    transports: [
      new transports.Console(),
      new transports.File({
        filename: `./Logs/${new Date().toISOString().split('T')[0]}.log`,
        format: combine(
          timestamp(),
          logFormat
        ),
        // Append log entries to the file
        options: { flags: 'a' },
      }),
    ],
  });
};
 
module.exports = createCustomLogger;
