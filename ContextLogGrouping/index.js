'use strict';

const uuid = require('node-uuid');

const utils = require('../utils');



// This establishes a private class instance namespace.
const namespace = new WeakMap();
function p(object) {
  if (!namespace.has(object)) namespace.set(object, {});
  return namespace.get(object);
}


/**
 *
 */
class ContextLogGrouping {
  constructor(config) {
    p(this).contextID = uuid.v4();

    p(this).mergedContextIDs = new Set([p(this).contextID]);

    p(this).logs = [];

    p(this).timers = new Set();
  }

  /**
   *
   */
  output(loggable) {

    // TODO Sort logs and timers by timestamp.
    const output = {contextID: p(this).contextID};

    if (loggable) {
      output.logs = p(this).logs.map(log => log.output ? log.output() : log);
      output.timers = Array.from(p(this).timers).map(timer => timer.output ? timer.output() : timer);
    }
    else {
      output.logs = p(this).logs;
      output.timers = p(this).timers;
    }

    const mergedIDs = p(this).mergedContextIDs;

    if (mergedIDs.size > 1) output.mergedContextIDs = Array.from(mergedIDs);

    return output;
  }

  /**
   * Merge another ContextLogGrouping into this one.
   */
  combine(contextLogGrouping) {
    const output = contextLogGrouping.output();
    p(this).mergedContextIDs.add(output.contextID);
    if (output.mergedContextIDs) {
      output.mergedContextIDs.forEach(id => p(this).mergedContextIDs.add(id));
    }
    const outputs = new Map();
    const logs = mapOutputs(p(this).logs);
    const otherLogs = mapOutputs(output.logs);
    p(this).logs = utils.mergeSorted(logs, otherLogs, (a, b) => {
      return outputs.get(a).timestamp - outputs.get(b).timestamp;
    });

    const timers = mapOutputs(Array.from(p(this).timers));
    const otherTimers = mapOutputs(Array.from(output.timers));
    p(this).timers = utils.mergeSorted(timers, otherTimers, (a, b) => {
      return outputs.get(a).start - outputs.get(b).start;
    });

    function mapOutputs(arr) {
      arr.forEach(item => outputs.set(item, item.output ? item.output() : item));
      return arr;
    }
  }

  /**
   *
   */
  addTimer(timer) {
    p(this).timers.add(timer);
  }

  /**
   *
   */
  addLog(log, level) {
    p(this).logs.push(log);
  }

  /**
   *
   */
  getContextID() {
    return p(this).contextID;
  }
}


module.exports = ContextLogGrouping;
