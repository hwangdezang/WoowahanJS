const _ = require('lodash');
const format = require('util').format;
const Debug = require('debug');
const Backbone = require('backbone');
const Router = require('./router');

const debug = Debug('Woowahan');
const INTERVAL = 1000/60;

const toolset = {
  get dispatch() {
    return instance.dispatch.bind(instance);
  },

  get getStates() {
    return instance.getStates.bind(instance);
  },

  get getComponent() {
    return instance.getComponent.bind(instance);
  },

  get getPopup() {
    return _.bind(instance.getPopup, instance);
  },
  get getRouteTables() {
    return instance.getRouteTables.bind(instance);
  },

  get addAction() {
    return instance.addAction.bind(instance);
  },

  get removeAction() {
    return instance.removeAction.bind(instance);
  },

  get addError() {
    return instance.addError.bind(instance);
  }
};

let instance;

/* Enable backbone.js devtools for chrome */
if (global.__backboneAgent) {
  global.__backboneAgent.handleBackbone(Backbone);
}

global._ = _;

Backbone.View.prototype.viewname = '___WOOWA_VIEW___';

class Woowahan {
  constructor(settings = {}) {
    this.reducers = settings.reducers || {};
    this.components = settings.components || {};
    this.popups = settings.popups || {};

    this.store = null;
    this.queue = [];
    this.actionObject = {};
    this.queuemonitor = null;
    
    instance = this;
    
    this.enableQueue();
  }

  enableQueue() {
    this.queuemonitor = setInterval(this.queuing.bind(this), INTERVAL);
  }

  disableQueue() {
    this.queuemonitor = clearInterval(this.queuemonitor);
  }

  addAction(id) {
    this.actionObject[id] = Date.now();

    if (this.numberOfWorkAction() === 1) {
      this.trigger('start');
    }
  }

  removeAction(id) {
    delete this.actionObject[id];

    if (this.numberOfWorkAction() === 0) {
      this.trigger('finish');
    }
  }

  addError(err) {
    this.trigger('error', err);
  }

  queuing() {
    this.disableQueue();

    let item = this.queue.shift();

    if(!!item) {
      var reducer = this.reducers[item.action.type];

      if(!reducer) {
        this.enableQueue();
        throw new Error('The unregistered reducer. Please check the type of action, if there is a written reducer use after registration.');
      }

      // 리스너가 없는 경우 허용
      item.subscriber = item.subscriber || function () {};

      if(typeof item.subscriber !== 'function') {
        this.enableQueue();
        throw new Error('The listener must be a function. If you do not need the listener it may not be specified.');
      }

      if (reducer.schema) {
        let errors = reducer.schema.validate(item.action.data);

        if (errors) {
          this.trigger('error', errors);
        } else {
          new (Function.prototype.bind.apply(reducer, Array.prototype.concat.call(reducer, item.action.data, item.subscriber.bind(this))))();
        }
      } else {
        new (Function.prototype.bind.apply(reducer, Array.prototype.concat.call(reducer, item.action.data, item.subscriber.bind(this))))();
      }
    }

    this.enableQueue();
  }

  bindStore(store) {
    this.store = store;
  }

  bindReducer(reducer) {
    this.reducers[reducer.actionName] = reducer;
  }

  bindComponent(component) {
    this.components[component.name] = component;
  }

  bindPopup(popup) {
    this.popups[popup.name] = popup;
  }

  bindPlugin(plugin) {
    Woowahan.View.prototype._plugins[plugin.type] = plugin.plugin;
  }

  combineReducer(reducers) {
    if (!reducers) return;

    reducers.forEach(reducer => {
      this.bindReducer(reducer);
    });
  }

  getStates() {
    return this.store;
  }

  getComponent(name) {
    const component = this.components[name];

    if (!!component) {
      return component.view;
    }
  }

  getPopup(name) {
    const popup = this.popups[name];

    if (!!popup) {
      return popup.view;
    }
  }

  getRouteTables() {
    return Router.routeTables;
  }

  dispatch(action, subscriber) {
    debug(format('dispatch action %s', action.type));
    this.queue.push({ action, subscriber });
  }
  
  use(module) {
    if (Array.isArray(module)) {
      module.forEach(m => this.useModule(m));
    } else {
      if (typeof module === 'object' && !('wwtype' in module)) {
        Object.keys(module).forEach(key => {
          if (typeof module[key] === 'function')
            this.useModule(module[key]);
        });
      } else { // function
        this.useModule(module);
      }
    }
  }

  useModule(module) {
    switch (module.wwtype) {
      case 'reducer':
        this.bindReducer(module);
        break;
      case 'layout':
        Router.bindLayout(module);
        break;
      case 'store':
        this.bindStore(module.store);
        break;
      case 'component':
        this.bindComponent(module);
        break;
      case 'popup':
        this.bindPopup(module);
        break;
      case 'plugin':
        this.bindPlugin(module);
        break;
    }
  }

  start(design, options = {}) {
    if (typeof jQuery === 'undefined') {
      throw new Error('jQuery is not loaded!!');
    }

    let wait = setInterval(() => {
      switch (document.readyState) {
        case 'complete': case 'loaded': break;
        default: return;
      }

      clearInterval(wait);

      if (!!design) {
        Router.design(design, options);
      }

      Backbone.history.start({
        pushState: !!options.pushState
      });
    }, 1);
  }

  numberOfAction() {
    return this.queue.length;
  }

  numberOfWorkAction() {
    return Object.keys(this.actionObject).length;
  }
}

Object.assign(Woowahan.prototype, Backbone.Events);

Woowahan.$ = Backbone.$;

Woowahan.Model          = require('./model');
Woowahan.Collection     = require('./collection');

module.exports = global.Woowahan = Woowahan;

Woowahan.View           = require('./view')(toolset);
Woowahan.Reducer        = require('./reducer')(toolset);
Woowahan.Error          = require('./error');
Woowahan.Types          = require('./types');
Woowahan.Store          = require('./store');
Woowahan.Action         = require('./action');
Woowahan.Event          = require('./event');
Woowahan.Schema         = require('./schema');
Woowahan.Layout         = require('./layout');
Woowahan.Popup          = require('./popup');
Woowahan.Component      = require('./component');
Woowahan.Plugin         = require('./plugin');

/** components */
Woowahan.CollectionView = require('./collection-view')(toolset);
Woowahan.ItemView       = require('./item-view')(toolset);

/** defaults */
Woowahan.Model.prototype.idAttribute = '___ID_ATTR___';