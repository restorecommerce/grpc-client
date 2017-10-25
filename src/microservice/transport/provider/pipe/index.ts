'use strict';

import * as _ from "lodash";
const errors = require('../../../errors');

/**
 * Name of the transport
 *
 * @const
 */
const NAME = 'pipe';

const servers = {};

/**
 * Client transport provider.
 * Connects to pipe servers over a internal list.
 * @class
 */
export class Client {

  config: any;
  logger: any;
  name: string;
  state: any;
  connected: boolean;

  /**
   * Create a pipe client.
   * @constructor
   * @param {object} config Pipe client config.
   * @logger {Logger} logger
   */
  constructor(config: any, logger: any) {
    // check config
    if (!_.has(config, 'service')) {
      throw new Error('client is missing service config field');
    }

    this.name = NAME;
    this.config = config;
    this.logger = logger;
    this.state = {
      connected: true,
    };
  }

  /**
   * Create endpoint from instance and method name.
   * @param {string} methodName Name of the business logic service method.
   * @param {string} instance Identifier which is used to find a server.
   * @return {generator} Returns the endpoint.
   */
  async makeEndpoint(methodName: string, instance: string): Promise<any> {
    const logger = this.logger;
    logger.debug('pipe.makeEndpoint', methodName, instance);
    const server = _.get(servers, instance);
    if (_.isNil(server)) {
      throw new Error(`server with ${instance} address does not exist`);
    }
    const service = server.service[this.config.service];
    if (_.isNil(service)) {
      throw new Error(`server does not have service ${this.config.service}`);
    }
    const method = service[methodName];
    const state = this.state;
    const serviceName = this.config.service;
    return async function pipe(request: any, context: any): Promise<any> {
      if (_.isNil(method)) {
        return {
          error: new Error('unimplemented'),
        };
      }

      if (!state.connected) {
        return {
          error: new Error('unreachable'),
        };
      }
      const serverContext = {
        transport: 'pipe',
        logger,
      };
      const call = {
        request: request || {},
      };
      try {
        const response = await method(call, serverContext);
        logger.debug(`response from ${serviceName}.${methodName}`, response);
        return {
          data: response,
        };
      } catch (error) {
        let err;
        _.forEach(errors, (Error) => {
          if (error.constructor.name === Error.name) {
            err = new Error(error.details);
          }
        });
        if (_.isNil(err)) {
          err = new errors.Internal(error.message);
        }
        return {
          error: err,
        };
      }
    };
  }

  /**
   * Set client to be disconnected.
   */
  async end(): Promise<any> {
    this.connected = false;
  }
}

module.exports.Name = NAME;
