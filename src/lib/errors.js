'use strict';

class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (msg, details) => new AppError(400, 'bad_request', msg, details);
const unauthorized = (msg = 'Authentication required') => new AppError(401, 'unauthorized', msg);
const forbidden = (msg = 'You do not have permission to do this') => new AppError(403, 'forbidden', msg);
const notFound = (msg = 'Not found') => new AppError(404, 'not_found', msg);
const conflict = (msg) => new AppError(409, 'conflict', msg);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict };
