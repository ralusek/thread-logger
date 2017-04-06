'use strict';

const traceback = require('traceback-safe');



// This establishes a private class instance namespace.
const namespace = new WeakMap();
function p(object) {
  if (!namespace.has(object)) namespace.set(object, {});
  return namespace.get(object);
}


/**
 *
 */
class ContextLog {
  constructor(config) {
    config = config || {};

    p(this).contextID = config.contextID;
    p(this).type = config.type;
    p(this).timestamp = Date.now();
    p(this).logArguments = config.logArguments;

    if (config.trace !== false) {
      const stackDepth = config.stackDepth || 2;
      const stack = traceback.raw();

      if (Array.isArray(stack)) {
        const caller = stack[stackDepth];
        const meta = p(this).meta = {};

        const fileName = caller.getFileName();
        if (fileName) meta.fileName = fileName;
        const functionName = caller.getFunctionName();
        if (functionName) meta.functionName = functionName;
        const methodName = caller.getMethodName();
        if (methodName) meta.methodName = methodName;
        const lineNumber = caller.getLineNumber();
        if (lineNumber) meta.lineNumber = lineNumber;

        Object.freeze(meta);
      }
    }
  }

  /**
   *
   */
  output() {
    const output = {
      contextID: p(this).contextID,
      type: p(this).type,
      timestamp: p(this).timestamp,
      logArguments: p(this).logArguments
    };

    if (p(this).meta) output.meta = p(this).meta;

    return output;
  }
}


module.exports = ContextLog;
