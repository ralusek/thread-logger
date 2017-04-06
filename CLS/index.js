'use strict';

const _get = require('lodash.get');
const _isFunction = require('lodash.isFunction');
const cls = require('continuation-local-storage');
const clsBluebird = require('cls-bluebird');

const CONSTANTS = require('./constants');


// This establishes a private class instance namespace.
const instance = new WeakMap();
function p(object) {
  if (!instance.has(object)) instance.set(object, {});
  return instance.get(object);
}


/**
 *
 */
class CLS {
  constructor(config) {
    config = config || {};

    p(this).namespaceName = config.namespace || CONSTANTS.DEFAULT.NAMESPACE_NAME;
    const existingNamespace = cls.getNamespace(p(this).namespaceName);
    if (existingNamespace) p(this).namespace = existingNamespace;
    else p(this).namespace = cls.createNamespace(p(this).namespaceName);

    config.promise ? clsBluebird(p(this).namespace, config.promise) : clsBluebird(p(this).namespace);

    p(this).mapping = Object.freeze({
      anchorToContexts: new WeakMap(),
      contextToAnchors: new WeakMap()
    });
  }

  /**
   * For a given anchor or context, fetch all of the known associated contexts.
   */
  fetchAssociatedContexts(anchorOrContext) {
    const mapping = p(this).mapping;

    const contexts = new Set();
    
    const checked = {anchor: new Set(), context: new Set()};

    function chainFromContext(context) {
      if (!context || checked.context.has(context)) return;
      checked.context.add(context);
      const foundAnchors = mapping.contextToAnchors.get(context);
      if (foundAnchors) {
        contexts.add(context);
        foundAnchors.forEach(anchor => chainFromAnchor(anchor));
      }
    }


    function chainFromAnchor(anchor) {
      if (!anchor || checked.anchor.has(anchor)) return;
      checked.anchor.add(anchor);
      const foundContexts = mapping.anchorToContexts.get(anchor);
      if (foundContexts) {
        foundContexts.forEach(context => chainFromContext(context));
      }
    }

    chainFromContext(anchorOrContext);
    chainFromAnchor(anchorOrContext);

    return contexts;
  }

  /**
   * Associates an anchor with the current context. This can be any object,
   * such as the request object of a given express request, that can be used to
   * resolve any fractured CLS contexts.
   */
  associateAnchorWithContext(anchor) {
    const mapping = p(this).mapping;
    
    const activeContext = this.getActiveContext();

    let anchorContexts = p(this).mapping.anchorToContexts.get(anchor);
    if (!anchorContexts) {
      anchorContexts = new Set();
      p(this).mapping.anchorToContexts.set(anchor, anchorContexts);
    }
    anchorContexts.add(activeContext);

    let contextAnchors = p(this).mapping.contextToAnchors.get(activeContext);
    if (!contextAnchors) {
      contextAnchors = new Set();
      p(this).mapping.contextToAnchors.set(activeContext, contextAnchors);
    }
    contextAnchors.add(anchor);
  }

  /**
   *
   */
  ensureContext(cb) {
    const self = this;
    if (!_isFunction(cb)) throw new Error(`ThreadLogger.cls.ensureContext requires a callback be specified.`);
    if (!namespace.active) {
      namespace.run(function() {
        cb();
      });
    }
    else cb();
  }

  /**
   *
   */
  getNamespace() {
    const namespace = p(this).namespace;
    if (!namespace) throw new Error(`ThreadLogger internal error. Namespace unavailable.`);
    return namespace;
  }

  /**
   *
   */
  getActiveContext() {
    const namespace = this.getNamespace();
    const activeContext = namespace.active;
    if (!activeContext) throw new Error(`ThreadLogger could not find any active context. Make
                                         sure necessary middleware is being run.`);
    return activeContext;
  }
}


module.exports = CLS;
