'use strict';
const { z } = require('zod');
const { badRequest } = require('./errors');

/**
 * Express middleware: validates req[source] against a zod schema and stores the
 * parsed result on req.valid[source]. Unknown keys are stripped by zod objects.
 */
function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      return next(badRequest('Invalid request', z.flattenError(result.error)));
    }
    req.valid = req.valid || {};
    req.valid[source] = result.data;
    return next();
  };
}

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

module.exports = { validate, objectId, pagination, z };
