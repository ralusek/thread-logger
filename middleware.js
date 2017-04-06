'use strict';

const _get = require('lodash.get');


// This establishes a private class instance namespace.
const instance = new WeakMap();
function p(object) {
  if (!instance.has(object)) instance.set(object, {});
  return instance.get(object);
}


/**
 *
 */
class CLSMiddleWare {
  constructor(threadLogger) {
    p(this).threadLogger = threadLogger;
    p(this).cls = threadLogger.cls;

    p(this).requests = new WeakSet();
  }


  /**
   *
   */
  ensureContext() {
    const self = this;
    return (req, res, next) => {
      const namespace = p(this).cls.getNamespace();
      if (!namespace.active) {
        namespace.bindEmitter(req);
        namespace.bindEmitter(res);
        namespace.run(function() {
          p(self).cls.associateAnchorWithContext(req);
          p(self).threadLogger.ensureContextLogGrouping();
          next();
        });
      }
      else {
        p(this).cls.associateAnchorWithContext(req);
        next();
      }
    };
  }

  /**
   *
   */
  addRequestLogging(cb) {
    const self = this;
    
    return [
      this.ensureContext(),
      (req, res, next) => {
        try {
          const alreadyEncountered = p(this).requests.has(req);
          p(this).requests.add(req);

          if (!alreadyEncountered) {
            const timer = p(self).threadLogger.timerStart('request');

            res.on('finish', logRequest);
            res.on('close',  logRequest);

            function logRequest() {
              p(self).threadLogger.timerEnd(timer);

              res.removeListener('finish', logRequest);
              res.removeListener('close',  logRequest);

              const combined = p(self).threadLogger.combineAllAssociatedContextLogGroupings(req);

              const result = {req, res, log: formatRequest(combined, req, res)};

              result.isError ? cb(result) : cb(null, result);
            }
          }
          next();
        }
        catch(err) { next(err); }
      }
    ];
  }
}

function formatRequest(contextLog, req, res) {
  return Object.assign(contextLog.output(true), {
    statusCode: res.statusCode,
    method: req.method,
    url: (req.originalUrl || req.url || '').split('?')[0].replace(/\/$/, ''),
    query: Object.assign({}, req.query || {}),
    body: Object.assign({}, req.body || {}),
    params: Object.assign({}, req.params || {}),
    ip: _get(req, 'headers.x-forwarded-for', _get(req, 'connection.remoteAddress')),
    referrer: req.get('Referrer') || _get(req, 'headers.host'),
    isError: res.statusCode >= 400
  });
}


module.exports = CLSMiddleWare;
