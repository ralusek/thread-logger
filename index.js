'use strict';

const Promise = require('bluebird');
const _get = require('lodash.get');
const _isFunction = require('lodash.isFunction');
const _forOwn = require('lodash.forown');
const _profile = require('hodash.profile');

const CLS = require('./CLS');
const ContextLog = require('./ContextLog');
const ContextLogGrouping = require('./ContextLogGrouping');
const CLSMiddleWare = require('./middleware');


const CONSTANTS = require('./constants');


// This establishes a private class instance namespace.
const instance = new WeakMap();
function p(object) {
  if (!instance.has(object)) instance.set(object, {});
  return instance.get(object);
}


class ThreadLogger {
  constructor(config) {
    this.configure(config);

    // Add read-only value MW for middleware functionality.
    Object.defineProperty(this, 'MW', {
      enumerable: true,
      value: new CLSMiddleWare(this)
    });
  }

  /**
   *
   */
  configure(config) {
    const self = this;
    config = config || {};

    const cls = new CLS(config);
    if (!this.cls) {
      // Add read-only value.
      Object.defineProperty(this, 'cls', {
        enumerable: true,
        get: () => cls
      });
    }
      

    p(this).contextLogGroupingPropName = config.contextLogGroupingPropName || CONSTANTS.DEFAULT.CONTEXT_LOG_PROPERTY_NAME;

    p(this).output = {
      contextLogGrouping: _get(config, 'logToContextLogGrouping', true),
      // User should explicitly pass false or their own logger, else use console.
      logger: _get(config, 'logger', console.log)
    };

    // Remove previous methods defined.
    if (p(this).levels) p(this).levels.forEach(level => delete this[level]);

    p(this).levels = config.levels || CONSTANTS.DEFAULT.LEVELS;
    p(this).levelsAsMap = p(this).levels.reduce((map, level, i) => {
      map[level] = i;
      return map;
    }, {});

    p(this).logThreshold = config.logThreshold || (p(this).levels.length - 1);

    p(this).levels.forEach(level => {
      this[level] = function() {
        if (p(this).levelsAsMap[level] > p(this).logThreshold) return;
        const contextLogGrouping = self.ensureContextLogGrouping();
        const contextLog = new ContextLog({
          contextID: contextLogGrouping.getContextID(),
          type: level,
          logArguments: Array.from(arguments)
        });

        if (p(this).output.contextLogGrouping) contextLogGrouping.addLog(contextLog);
        if (p(this).output.logger) p(this).output.logger(contextLog.output());
      }
    });
  }

  /**
   *
   */
  timerStart(name) {
    const timer = _profile(name);
    if (p(this).output.contextLogGrouping) {
      const contextLogGrouping = this.ensureContextLogGrouping();
      contextLogGrouping.addTimer(timer);
    }
    return timer;
  }

  /**
   *
   */
  timerEnd(timer, logLevel) {
    timer.end();

    if (logLevel) {
      if (!p(this).levelsAsMap.has(logLevel)) {
        throw new Error(`ThreadLogger timerEnd logLevel must be one of the existing logLevels:
                         ${p(this).levels.join(', ')}. ${logLevel} was provided.`);
      }
      p(this)[logLevel](timer.output());
    }
  }

  /**
   *
   */
  time(name, f, logLevel, ctx) {
    const self = this;
    return function() {
      const timer = self.timerStart(name);

      const result = f.apply(ctx, arguments);

      if (_isFunction(_get(result, 'then'))) {
        return Promise.resolve(result)
        .finally(() => self.timerEnd(timer, logLevel));
      }

      // Result is not a promise, end timer synchronously and return result.
      self.timerEnd(timer, logLevel);
      return result;
    };
  }

  /**
   *
   */
  profileAll(module, formatKey) {
    formatKey = _isFunction(formatKey) ? formatKey : (key) => key;
    _forOwn(module, (item, key) => {
      if (_isFunction(item)) {
        module[key] = this.time(formatKey(key), item);
      }
    });
  }

  /**
   *
   */
  getContextLogGroupingPropName() {
    return p(this).contextLogGroupingPropName;
  }

  /**
   *
   */
  ensureContextLogGrouping() {
    const namespace = this.cls.getNamespace();
    const contextLogGrouping = namespace.get(p(this).contextLogGroupingPropName);
    if (contextLogGrouping) return contextLogGrouping;
    const newContextLogGrouping = new ContextLogGrouping();
    namespace.set(p(this).contextLogGroupingPropName, newContextLogGrouping);
    return newContextLogGrouping;
  }

  /**
   *
   */
  combineAllAssociatedContextLogGroupings(anchor) {
    const propName = this.getContextLogGroupingPropName();
    const startingPoint = anchor || this.cls.getActiveContext();
    const contexts = Array.from(this.cls.fetchAssociatedContexts(startingPoint));
    const combined = contexts.reduce((combined, context) => {
      if (!combined) combined = context[propName];
      else combined.combine(context[propName]);

      return combined;
    }, null);
    if (!combined) throw new Error(`No associated ContextLogGroupings found.`);
    return combined;
  }
}


module.exports = new ThreadLogger();
