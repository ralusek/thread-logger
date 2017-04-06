'use strict';

const _get = require('lodash.get');
const _isFunction = require('lodash.isfunction');

/**
 *
 */
module.exports.mergeSorted = function mergeSorted(sortedA, sortedB, comparator) {
  const shorterI = ~~(sortedA.length > sortedB.length);
  const shorter = arguments[shorterI];
  const longer = arguments[shorterI ^ 1];
  const shorterLength = shorter.length;
  
  const merged = [];
  let i = 0;
  let j = 0;
  const compare = _isFunction(comparator) ? comparator : (a, b) => _compare(a, b, comparator);
  
  while (i < shorterLength) {
    const result = compare(shorter[i], longer[j]);
    if (result > 0) merged.push(longer[j++]);
    else merged.push(shorter[i++]);
  }
  
  return merged.concat(longer.slice(j));
}

function _compare(a, b, path) {
  if (path) {
    a = _get(a, path);
    b = _get(b, path);
  } 
  return a < b ? -1 : b < a ? 1 : 0;
}
