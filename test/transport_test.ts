import * as mocha from 'mocha';
import * as Logger from '@restorecommerce/logger';
import { Client as grpcClient } from '../lib/microservice/transport/provider/grpc';
import * as grpc from 'grpc';
import * as should from 'should';
import * as sleep from 'sleep';

/* global describe it before after*/

const providers = [{
  config: {
    client: {
      name: 'grpcTest',
      provider: 'grpc',
      service: 'test.Test',
      protos: ['test/test.proto'],
      protoRoot: 'protos/',
      addr: 'grpc://localhost:50051',
      timeout: 100,
    },
  },
  name: 'grpc',
  Client: grpcClient,
}
];

const loggerConfig = {
  logger: {
    console: {
      handleExceptions: false,
      level: 'info',
      colorize: true,
      prettyPrint: true
    }
  }
};
const PROTO_PATH = './protos/test/test.proto';
const test_proto = grpc.load(PROTO_PATH).test;
const logger = new Logger(loggerConfig.logger);

/**
 * Implementation of  test RPC method.
 */
function test(call, callback) {
  const request = call.request;
  callback(null, {
    result: 'welcome',
  });
}

providers.forEach((provider) => {
  describe(`transport provider ${provider.name}`, () => {
    describe('the server', () => {
      let server;
      describe('constructing the server provider with proper config',
        () => {
          it('should result in a server transport provider', () => {
            server = new grpc.Server();
            should.exist(server);
          });
        });
      describe('binding a service', () => {
        it('should result in a wrapped service', function bindService() {
          server.addService(test_proto.Test.service, { test });
          server.bind('localhost:50051', grpc.ServerCredentials.createInsecure());
        });
      });
      describe('start', () => {
        it('should start the server', function startServer() {
          server.start();
        });
      });
      describe('stop', () => {
        it('should stop the server', async function stopServer() {
          server.tryShutdown((err, res) => {
            if (err) {
              throw new Error('Error while shutting down the server :' + err);
            }
          });
        });
      });
    });
    describe('the client', () => {
      const Client = provider.Client;
      let client;
      const methodName = 'test';
      const methodNameFail = 'this_method_does_not_exist';
      const instance = provider.config.client.addr;
      let endpoint;
      const response = {
        result: 'welcome',
      };
      const request = {
        value: 'hello',
      };
      it('should conform to a client provider', () => {
        should.exist(Client.constructor);
        should.exist(Client.prototype.makeEndpoint);
      });
      describe('constructing the client provider with proper config',
        () => {
          it('should result in a client transport provider', () => {
            client = new Client(provider.config.client, logger);
            should.exist(client);
          });
        });
      describe('makeEndpoint', () => {
        it('should fail when creating an undefined protobuf method',
          function checkMakeEndpoint() {
            try {
              endpoint = client.makeEndpoint(methodNameFail, instance);
            }
            catch (err) {
              should.exist(err);
            }
            should.not.exist(endpoint);
          });
        describe('without running server', function runWithoutServer() {
          this.slow(200);
          it('should fail', async function checkMakeEndpoint() {
            endpoint = client.makeEndpoint(methodName, instance);
            const result = await endpoint();
            result.error.should.be.Error();
            result.error.message.should.equal('unavailable');
          });
        });
        describe('with running server', () => {
          const errMessage = 'forced error';
          let server;
          before(function startServer() {
            server = new grpc.Server();
            server.addService(test_proto.Test.service, { test });
            server.bind('localhost:50051', grpc.ServerCredentials.createInsecure());
            server.start();
            sleep.sleep(1);
          });
          after(function stopServer() {
            server.tryShutdown((err, res) => {
              if (err) {
                throw new Error('Error while shutting down the server :' + err);
              }
            });
          });
          it('should create an endpoint', function makeEndpoint() {
            endpoint = client.makeEndpoint(methodName, instance);
            should.exist(endpoint);
          });
          it('should succeed when calling with empty context', async function checkWithEmptyContext() {
            const result = await endpoint(request);
            should.ifError(result.error);
            should.deepEqual(response, result.data);
          });
          it('should succeed when calling without context', async function checkWithoutContext() {
            const result = await endpoint(request);
            should.ifError(result.error);
            should.deepEqual(response, result.data);
          });
          it('should return an error when calling a unimplemented method',
            async function checkUnimplemented() {
              let result;
              try {
                const endpointThrow = client.makeEndpoint('notImplemented', instance);
                should.not.exist(endpointThrow);
                result = await endpointThrow(request);
              } catch (error) {
                should.equal(error.message, 'conn has no method notImplemented');
              }
            });
        });
      });
    });
  });
});
