'use strict';

const loadBalancerLib = require('./loadbalancer');
const chainMiddleware = require('./endpoint').chain;
import * as co from 'co';
import * as _ from 'lodash';
import { EventEmitter } from 'events';
const Logger = require('../logger').Logger;

// loadbalancers
const loadBalancers: any = {};

export function registerLoadBalancer(name: string, provider: any): void {
  loadBalancers[name] = provider;
}
// module.exports.registerLoadBalancer = registerLoadBalancer;

function makeRoundRobinLB(config: any, publisher: any, logger: any): any {
  return loadBalancerLib.roundRobin(publisher, logger);
}

function makeRandomLB(config: any, publisher: any, logger: any): any {
  const seed = config.seed || Math.random();
  return loadBalancerLib.random(publisher, seed, logger);
}
registerLoadBalancer('roundRobin', makeRoundRobinLB);
registerLoadBalancer('random', makeRandomLB);

// publishers
const publishers = {};

/**
 * register endpoint publishers
 *
 * @param  {string} name     Publisher name
 * @param  {generator} provider generator which can be iterated
 */
export function registerPublisher(name: string, provider: any): void {
  publishers[name] = provider;
}
// module.exports.registerPublisher = registerPublisher;
// register default publishers
function makeStaticPublisher(config: any, factory: any, logger: any): any {
  return loadBalancerLib.staticPublisher(config.instances, factory, logger);
}
registerPublisher('static', makeStaticPublisher);

// transport providers
const transportProviders = {};

/**
 * register a transport
 *
 * @param  {string} name      transport identifier
 * @param  {constructor} transport Transport provider constructor
 */
export function registerTransport(name: string, transport: any): void {
  transportProviders[name] = transport;
}
// module.exports.registerTransport = registerTransport;
// register default transport providers
const grpc = require('./transport/provider/grpc');

registerTransport(grpc.Name, grpc.Client);
const pipe = require('./transport/provider/pipe');

registerTransport(pipe.Name, pipe.Client);

async function getEndpoint(loadBalancer: any): Promise<any> {
  return await (co(async function getEndpointFromLB(): Promise<any> {
    const lb = loadBalancer.next();
    if (lb.done) {
      throw new Error('no endpoints');
    }
    return lb.value;
  }).catch((err) => {
    throw err;
  }));
}

// handles retries, timeout, middleware, calling the loadBalancer and errors
function makeServiceEndpoint(name: string, middleware: any,
  loadBalancer: any, logger: any): any {
  const e = async function handleRetryAndMiddleware(request: any,
    options: any): Promise<any> {
    let attempts = 1;
    if (options && options.retry) {
      attempts += options.retry;
    }
    const errs = [];
    const context = Object.assign(options || {}, {
      endpointName: name,
      attempts,
      currentAttempt: 1,
    });
    logger.debug(`calling endpoint with request ${request}`);
    for (let i = 1; i <= attempts; i += 1) {
      context.currentAttempt = i;
      logger.debug(`attempt ${i}/${attempts} calling endpoint with request ${request}`);
      try {
        let endpoint = await getEndpoint(loadBalancer);
        if (middleware.length !== 0) {
          const chain = chainMiddleware(middleware);
          endpoint = await chain(endpoint);
        }
        const result = await endpoint(request, context);
        if (result.write || result.read) {
          return result;
        }
        if (result.error) {
          switch (result.error.message) {
            case 'unimplemented':
            case 'resource exhausted':
            case 'unknown':
            case 'internal':
            case 'unavailable':
            case 'data loss':
              logger.error(`attempt ${i}/${attempts} error`, result.error);
              errs.push(result.error);
              // retry
              continue;
            default:
              return await result;
          }
        }
        return await result;
      } catch (err) {
        logger.error(`attempt ${i}/${attempts} error`, err);
        errs.push(err);
        if (err.message === 'call timeout') {
          logger.debug(`attempt ${i}/${attempts} returning with call timeout`);
          return {
            error: errs,
          };
        }
      }
    }
    return {
      error: errs,
    };
  };
  return async function handleTimeout(req: any, options: any): Promise<any> {
    if (options && options.timeout) {
      const gen = e(req, options);
      const thunk = (cb) => {
        co(gen).catch(cb).then((result) => {
          cb(null, result);
        });
      };
      return await co(async function checkTimeout(): Promise<any> {
        return assertTimeout(thunk, options.timeout);
      }).catch((error) => {
        if (error.message.startsWith('timeout')) {
          const err = new Error('call timeout');
          const res: any = gen.then((resolved) => Promise.reject(err));
          return res.value;
        }
        return {
          error,
        };
      });
    }
    return await co(async function callEndpoint(): Promise<any> {
      return await e(req, options);
    }).catch((err) => {
      return {
        error: err,
      };
    });
  };
}


function assertTimeout(fn: any, timeout: any, logger?: any): any {
  return function (done) {
    if (typeof timeout === 'string')
      timeout = parseInt(timeout);
    if (typeof timeout !== 'number')
      throw new TypeError('invalid timeout');

    let ctx = this;
    let called = false;

    let id = setTimeout(function () {
      let err: any = new Error('timeout of ' + timeout + 'ms exceeded');
      err.status = 408;
      err.exposed = true;
      err.timeout = timeout;
      called = true;
      done(err);
    }, timeout);

    fn.call(this, function () {
      if (called)
        return logger && logger.apply(ctx, arguments);

      clearTimeout(id);
      done.apply(ctx, arguments);
    });
  };
}

// returns a factory which turns an instance into an endpoint via a transport provider
function generalFactory(method: any, transports: any, logger: any): any {
  return async function makeEndpoints(instance: any): Promise<any> {
    for (let i = 0; i < transports.length; i += 1) {
      try {
        const endpoint = await transports[i].makeEndpoint(method, instance);
        return endpoint;
      } catch (e) {
        logger.debug('generalFactory transport.makeEndpoint',
          method, transports[i].name, instance, e);
      }
    }
    throw new Error('no endpoint');
  };
}

/**
 * Microservice client.
 * @class
 */
export class Client extends EventEmitter {
  config: any;
  logger: any;
  transports: any;
  endpoints: any;
  middleware: any;
  /**
 * Client is a microservice client.
 *
 * @constructor
 * @param {Object} name Name of the configured client.
 */
  constructor(config?: any, logger?: any) {
    super();
    if (_.isNil(config)) {
      throw new Error('missing config argument');
    }
    this.config = config;
    // check config
    if (!this.config.endpoints || _.keys(this.config.endpoints).length === 0) {
      throw new Error('no endpoints configured');
    }
    if (!this.config.transports || _.keys(this.config.transports).length === 0) {
      throw new Error('no transports configured');
    }

    // logger
    if (_.isNil(logger)) {
      if (_.isNil(this.config.logger)) {
        this.logger = new Logger();
      } else {
        this.logger = new Logger(this.config.logger);
      }
    } else {
      this.logger = logger;
    }

    // transport
    const log = this.logger;
    const transports = [];
    _.forIn(this.config.transports, (transportConfig, transportName) => {
      const Transport = transportProviders[transportName];
      if (!Transport) {
        log.error(`transport ${transportName} does not exist`);
        return;
      }
      try {
        const provider = new Transport(transportConfig, log);
        transports.push(provider);
      } catch (e) {
        log.error(e.stack);
      }
    });
    if (transports.length === 0) {
      throw new Error('no transports properly configured');
    }
    this.transports = transports;

    // detect global loadbalancer
    let defaultLoadBalancer = loadBalancers.roundRobin;
    if (this.config.loadbalancer) {
      defaultLoadBalancer = loadBalancers[this.config.loadbalancer.name];
    }

    // detect global publisher
    let defaultPublisher;
    if (this.config.publisher) {
      defaultPublisher = publishers[this.config.publisher.name];
      if (!defaultPublisher) {
        this.logger.error(`publisher ${this.config.publisher.name} does not exist`);
      }
    }

    // setup endpoints
    this.endpoints = {};
    _.forIn(this.config.endpoints, (endpointConfig, endpointName) => {
      // publisher
      let publisher = defaultPublisher;
      let publisherCfg = this.config.publisher;
      if (endpointConfig.publisher && endpointConfig.publisher.name) {
        publisher = publishers[endpointConfig.publisher.name];
        publisherCfg = endpointConfig.publisher;
      }
      if (!publisher) {
        if (!publisherCfg) {
          this.logger.error(`publisher configuration for endpoint ${endpointName} does not exist`);
          return;
        }
        this.logger.error(`publisher ${publisherCfg.name} does not exist`);
        return;
      }

      // loadBalancer
      let loadBalancer = defaultLoadBalancer;
      let loadBalancerCfg = this.config.loadbalancer;
      if (endpointConfig.loadbalancer && endpointConfig.loadbalancer.name) {
        loadBalancer = loadBalancers[endpointConfig.loadbalancer.name];
        loadBalancerCfg = endpointConfig.loadbalancer;
      }
      if (!loadBalancer) {
        if (!loadBalancerCfg) {
          this.logger.error(`loadBalancer endpoint configuration ${endpointName} does not exist`);
          return;
        }
        this.logger.error(`loadbalancer ${loadBalancerCfg.name} does not exist`);
        return;
      }

      this.endpoints[endpointName] = {
        publisher, // publisher(config, factory)
        publisherConfig: publisherCfg,
        loadBalancer, // loadBalancer(config, publisher)
        loadBalancerConfig: loadBalancerCfg,
      };
    });
    if (Object.keys(this.endpoints).length === 0) {
      throw new Error('no endpoints properly configured');
    }

    /**
     * A list of middleware which gets called before the endpoint.
     * The endpoint includes [retry, timeout], publisher, loadBalancer, transport.
     *
     * @type {Array}
     */
    this.middleware = [];
  }

  /**
   * Connect to the provided endpoints via specified transports.
   *
   * @return {Object} Service with endpoint methods.
   */
  async connect(): Promise<any> {
    const logger = this.logger;
    const transports = this.transports;
    const endpoints = this.endpoints;
    const middleware = this.middleware;
    const s = await co(async function createService(): Promise<any> {
      const service = {};
      _.forIn(endpoints, (e, name) => {
        const factory = generalFactory(name, transports, logger);
        const publisher = e.publisher(e.publisherConfig, factory, logger);
        const loadBalancer = e.loadBalancer(e.loadBalancerConfig, publisher, logger);
        service[name] = makeServiceEndpoint(name, middleware, loadBalancer, logger);
      });
      logger.verbose('gRPC service ready', service);
      return service;
    });
    this.emit('connected', s);
    return s;
  }

  /**
   * Stop all transport provider communication.
   */
  async end(): Promise<any> {
    for (let i = 0; i < this.transports.length; i += 1) {
      const transport = this.transports[i];
      await transport.end();
    }
    this.emit('disconnected');
  }
}
