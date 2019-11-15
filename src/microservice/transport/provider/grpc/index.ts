import * as path from 'path';
import * as url from 'url';
import * as grpc from 'grpc';
import * as co from 'co';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as errors from '../../../errors';
import * as rTracer from 'cls-rtracer';
import { Logger } from '../../../../logger';

/**
 * Name of the transport
 *
 * @const
 */
export const NAME = 'grpc';

const errorMap = new Map([
  [grpc.status.CANCELLED, errors.Cancelled],
  [grpc.status.INVALID_ARGUMENT, errors.InvalidArgument],
  [grpc.status.NOT_FOUND, errors.NotFound],
  [grpc.status.ALREADY_EXISTS, errors.AlreadyExists],
  [grpc.status.PERMISSION_DENIED, errors.PermissionDenied],
  [grpc.status.UNAUTHENTICATED, errors.Unauthenticated],
  [grpc.status.FAILED_PRECONDITION, errors.FailedPrecondition],
  [grpc.status.ABORTED, errors.Aborted],
  [grpc.status.OUT_OF_RANGE, errors.OutOfRange],
  [grpc.status.UNIMPLEMENTED, errors.Unimplemented],
  [grpc.status.RESOURCE_EXHAUSTED, errors.ResourceExhausted],
  [grpc.status.DEADLINE_EXCEEDED, errors.DeadlineExceeded],
  [grpc.status.INTERNAL, errors.Internal],
  [grpc.status.UNAVAILABLE, errors.Unavailable],
  [grpc.status.DATA_LOSS, errors.DataLoss],
]);

/**
 * wrapClientEndpoint wraps the method of conn into an endpoint.
 *
 * @param  {Object} conn   A gRPC Client.
 * @param  {string} method The endpoint method name of the service.
 * @param  {object} stream Settings for request,response or bi directional stream.
 * @return {object|Promise} Returns a Promise for normal RPC.
 * Returns an object for streaming RPC.
 */
function wrapClientEndpoint(client: Object, methodName: string,
  stream: any): any {
  if (_.isNil(client)) {
    throw new Error('missing argument client');
  }
  if (_.isNil(methodName)) {
    throw new Error('missing argument methodName');
  }
  if (!client[methodName]) {
    throw new Error(`conn has no method ${methodName}`);
  }
  if (stream.requestStream && stream.responseStream) {
    return makeBiDirectionalStreamClientEndpoint(client, methodName);
  }
  if (stream.requestStream) {
    return makeRequestStreamClientEndpoint(client, methodName);
  }
  if (stream.responseStream) {
    return makeResponseStreamClientEndpoint(client, methodName);
  }
  return makeNormalClientEndpoint(client, methodName);
}

function makeBiDirectionalStreamClientEndpoint(client: any,
  methodName: any): any {
  return async function biDirectionalStreamClientEndpoint(): Promise<any> {
    const responses = [];
    const fns = [];
    let end = false;
    const call = client[methodName]();
    call.on('data', (response) => {
      if (fns.length) {
        fns.shift()(null, response);
      } else {
        responses.push(response);
      }
    });
    call.on('end', () => {
      end = true;
      while (fns.length) {
        fns.shift()(new Error('stream end'), null);
      }
    });
    call.on('error', (err) => {
      end = true;
      if (err.details === 'Connect Failed') {
        err.code = grpc.status.UNAVAILABLE;
      } else if (err.message.indexOf('invalid argument') > -1) {
        err.code = grpc.status.INVALID_ARGUMENT;
      } else if (err.message.indexOf('not found') > -1) {
        err.code = grpc.status.NOT_FOUND;
      } else if (err.message.indexOf('already exists') > -1) {
        err.code = grpc.status.ALREADY_EXISTS;
      } else if (err.message.indexOf('permission denied') > -1) {
        err.code = grpc.status.PERMISSION_DENIED;
      } else if (err.message.indexOf('unauthenticated') > -1) {
        err.code = grpc.status.UNAUTHENTICATED;
      } else if (err.message.indexOf('failed precondition') > -1) {
        err.code = grpc.status.FAILED_PRECONDITION;
      }
      if (err.code) {
        const Err = errorMap.get(err.code);
        const instance = new Err(err.details);
        fns.shift()(instance, null);
      }
    });
    return {
      async write(request: any, context: any): Promise<any> {
        call.write(request);
      },
      async read(): Promise<any> {
        return await function r(cb: any): any {
          if (responses.length) {
            cb(null, responses.shift());
          } else if (end) {
            throw new Error('stream end');
          } else {
            fns.push(cb);
          }
        };
      },
      async end(): Promise<any> {
        call.end();
      },
    };
  };
}

function makeRequestStreamClientEndpoint(client: any, methodName: any): any {
  return async function requestStreamClientEndpoint(): Promise<any> {
    const responses = [];
    const fns = [];
    let end = false;
    const call = client[methodName]((err, response) => {
      if (fns.length) {
        fns.shift()(err, response);
      } else {
        responses.push(response);
      }
    });
    call.on('data', (response) => {
      if (fns.length) {
        fns.shift()(null, response);
      } else {
        responses.push(response);
      }
    });
    call.on('end', () => {
      end = true;
      while (fns.length) {
        fns.shift()(new Error('stream end'), null);
      }
    });
    call.on('error', (err) => {
      end = true;
      if (err.details === 'Connect Failed') {
        err.code = grpc.status.UNAVAILABLE;
      } else if (err.message.indexOf('invalid argument') > -1) {
        err.code = grpc.status.INVALID_ARGUMENT;
      } else if (err.message.indexOf('not found') > -1) {
        err.code = grpc.status.NOT_FOUND;
      } else if (err.message.indexOf('already exists') > -1) {
        err.code = grpc.status.ALREADY_EXISTS;
      } else if (err.message.indexOf('permission denied') > -1) {
        err.code = grpc.status.PERMISSION_DENIED;
      } else if (err.message.indexOf('unauthenticated') > -1) {
        err.code = grpc.status.UNAUTHENTICATED;
      } else if (err.message.indexOf('failed precondition') > -1) {
        err.code = grpc.status.FAILED_PRECONDITION;
      }
      if (err.code) {
        const Err = errorMap.get(err.code);
        const instance = new Err(err.details);
        fns.shift()(instance, null);
      }
    });
    return {
      async write(request: any, context: any): Promise<any> {
        call.write(request);
      },
      async end(): Promise<any> {
        return await function r(cb: any): any {
          call.end();
          if (responses.length) {
            cb(null, responses.shift());
          } else if (end) {
            throw new Error('stream end');
          } else {
            fns.push(cb);
          }
        };
      },
    };
  };
}

function makeResponseStreamClientEndpoint(client: any, methodName: any): any {
  return async function responseStreamClientEndpoint(request: any,
    context: any): Promise<any> {
    const responses = [];
    const fns = [];
    let end = false;
    let req = request || {};
    const call = client[methodName](req);
    call.on('data', (response) => {
      if (fns.length) {
        fns.shift()(null, response);
      } else {
        responses.push(response);
      }
    });
    call.on('end', () => {
      end = true;
      while (fns.length) {
        fns.shift()(new Error('stream end'), null);
      }
    });
    call.on('error', (err) => {
      end = true;
      if (err.details === 'Connect Failed') {
        err.code = grpc.status.UNAVAILABLE;
      } else if (err.message.indexOf('invalid argument') > -1) {
        err.code = grpc.status.INVALID_ARGUMENT;
      } else if (err.message.indexOf('not found') > -1) {
        err.code = grpc.status.NOT_FOUND;
      } else if (err.message.indexOf('already exists') > -1) {
        err.code = grpc.status.ALREADY_EXISTS;
      } else if (err.message.indexOf('permission denied') > -1) {
        err.code = grpc.status.PERMISSION_DENIED;
      } else if (err.message.indexOf('unauthenticated') > -1) {
        err.code = grpc.status.UNAUTHENTICATED;
      } else if (err.message.indexOf('failed precondition') > -1) {
        err.code = grpc.status.FAILED_PRECONDITION;
      }
      if (err.code) {
        const Err = errorMap.get(err.code);
        const instance = new Err(err.details);
        fns.shift()(instance, null);
      }
    });
    return {
      async read(): Promise<any> {
        return await (function r(cb: any): any {
          if (responses.length) {
            cb(null, responses.shift());
          } else if (end) {
            throw new Error('stream end');
          } else {
            fns.push(cb);
          }
        });
      },
    };
  };
}

function makeNormalClientEndpoint(client: any, methodName: any): any {
  return async function normalClientEndpoint(request: any, context: any):
    Promise<any> {
    const options: any = {};
    if (_.has(context, 'timeout')) {
      options.deadline = Date.now() + context.timeout;
    }
    const req = request || {};
    function callEndpoint(): any {
      return new Promise((resolve, reject) => {
        try {
          let meta = new grpc.Metadata();
          const rid = rTracer.id();
          if (rid) {
            meta.add('rid', rid);
          }
          client[methodName](req, meta, options, (err, result) => {
            if (err) return reject(err);
            resolve(result);
          });
        } catch (err) {
          if (err.message === 'Call cannot be created from a closed channel') {
            err.code = grpc.status.UNAVAILABLE;
          }
          reject(err);
        }
      });
    }

    try {
      const result = await callEndpoint();
      const response = {
        error: null,
        data: result,
      };
      return response;
    }
    catch (err) {
      if (err.message === 'Call cannot be created from a closed channel') {
        err.code = grpc.status.UNAVAILABLE;
      } else if (err.message.indexOf('invalid argument') > -1) {
        err.code = grpc.status.INVALID_ARGUMENT;
      } else if (err.message.indexOf('not found') > -1) {
        err.code = grpc.status.NOT_FOUND;
      } else if (err.message.indexOf('already exists') > -1) {
        err.code = grpc.status.ALREADY_EXISTS;
      } else if (err.message.indexOf('permission denied') > -1) {
        err.code = grpc.status.PERMISSION_DENIED;
      } else if (err.message.indexOf('unauthenticated') > -1) {
        err.code = grpc.status.UNAUTHENTICATED;
      } else if (err.message.indexOf('failed precondition') > -1) {
        err.code = grpc.status.FAILED_PRECONDITION;
      }
      if (err.code) {
        const Err = errorMap.get(err.code);
        if (Err) {
          return {
            error: new Err(err.message),
          };
        }
      }
      throw err;
    }
  };
}

/**
 * Client is a gRPC transport provider for calling endpoints.
 *
 * @class
 * @param {Object} config Configuration object.
 * Requires properties: package,proto,service
 * Optional properties: timeout
 */
export class Client {

  name: string;
  config: any;
  logger: Logger;
  builder: any;
  proto: any;
  service: any;
  endpoint: any;

  /**
   * @param {object} config gRPC client config.
   * @param {Logger} logger
   * @constructor
   */
  constructor(config: any, logger: Logger) {
    this.name = NAME;
    this.config = config;
    this.logger = logger;

    grpc.setLogger(console);

    // check config
    if (!_.has(config, 'service')) {
      throw new Error('client is missing service config field');
    }

    // build protobuf
    const protoRoot = config.protoRoot || path.join(process.cwd(), 'protos');
    if (_.isNil(protoRoot) || _.size(protoRoot) === 0) {
      throw new Error('config value protoRoot is not set');
    }
    const protos = config.protos;
    if (_.isNil(protos) || _.size(protos) === 0) {
      throw new Error('config value protos is not set');
    }
    this.logger.verbose(`gRPC Client loading protobuf files from root ${protoRoot}`, { protos });

    // There will be only one proto since a client can connect to only
    // one service at a time.
    const proto = [];
    for (let i = 0; i < protos.length; i++) {
      const filePath = { root: protoRoot, file: protos[i] };
      this.proto = grpc.load(filePath, 'proto', {
        longsAsStrings: false
      });
      proto[i] = this.proto;
    }

    this.service = _.get(proto[0], this.config.service);
    if (_.isNil(this.service)) {
      throw new Error(`Could not find ${this.config.service} protobuf service`);
    }
    this.logger.verbose('gRPC service loaded', this.config.service);
    this.name = NAME;
  }

  /**
   * Create endpoint from instance and method name.
   * @param {string} methodName Name of the business logic service method.
   * @param {string} instance URL starting with schema "grpc:"
   * @return {Promise} Returns a Promise for the endpoint.
   */
  makeEndpoint(method: string, instance: string): any {
    const u = url.parse(instance, true, true);
    if (u.protocol !== 'grpc:') {
      throw new Error('not a grpc instance URL');
    }
    const host = u.host;
    let credentials = grpc.credentials.createInsecure();
    if (this.config.credentials) {
      if (this.config.credentials.ssl) {
        const certs = this.config.credentials.ssl.certs;
        const key = this.config.credentials.ssl.key;
        const chain = this.config.credentials.ssl.chain;
        credentials = grpc.credentials.createSsl(certs, key, chain);
      }
    }
    const conn = new this.service(host, credentials);
    if (this.config.timeout) {
      const deadline = Date.now() + this.config.timeout;
      const wait = function waitWrapper(): any {
        return (() => {
          return (callback: any): any => {
            grpc.waitForClientReady(conn, deadline, (err) => {
              if (err) {
                const chan = grpc.getClientChannel(conn);
                chan.close();
              }
              callback(err);
            });
          };
        });
      };
      wait();
    }
    const methods = this.service.service;
    const methodDef = _.find(methods, (m) => {
      return m.originalName.toLowerCase() === method.toLowerCase();
    });
    const stream = {
      requestStream: false,
      responseStream: false,
    };
    if (methodDef) {
      stream.requestStream = methodDef.requestStream;
      stream.responseStream = methodDef.responseStream;
    }
    const e = wrapClientEndpoint(conn, method, stream);
    if (!this.endpoint) {
      this.endpoint = {};
    }
    if (!this.endpoint[method]) {
      this.endpoint[method] = {
        instances: [],
      };
    }
    this.endpoint[method].instances.push({
      instance,
      conn,
      endpoint: e,
    });
    return e;
  }

  /**
   * Close the connection to the server.
   */
  async end(): Promise<any> {
    if (!this.endpoint) {
      return;
    }
    const endpoints = Object.keys(this.endpoint);
    for (let i = 0; i < endpoints.length; i += 1) {
      const endpoint = this.endpoint[endpoints[i]];
      for (let j = 0; j < endpoint.instances; j += 1) {
        const conn = endpoint.instances[j].conn;
        const chan = grpc.getClientChannel(conn);
        chan.close();
      }
    }
  }
}
