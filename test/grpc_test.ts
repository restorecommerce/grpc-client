import { Client } from './../lib/microservice/client';
import * as grpc from 'grpc';
import * as should from 'should';
import { createLogger } from '@restorecommerce/logger';

const grpcClientCfg = {
  client: {
    test: {
      transports: {
        grpc: {
          service: 'helloworld.Greeter',
          protos: [
            'helloworld/hello_world.proto'
          ],
          protoRoot: 'protos/',
          timeout: 3000
        }
      },
      loadbalancer: {
        name: 'roundRobin'
      },
      publisher: {
        name: 'static',
        instances: [
          'grpc://localhost:50051'
        ]
      },
      endpoints: {
        sayHello: {
          loadbalancer: {
            name: 'random',
            seed: 0
          },
          publisher: {
            name: 'static',
            instances: [
              'grpc://localhost:50051'
            ]
          }
        }
      },
      bufferFields: {
        HelloRequest: "data"
      }
    }
  }
};

const loggerConfig: any = {
  logger: {
    console: {
      handleExceptions: false,
      level: 'silly',
      colorize: true,
      prettyPrint: true
    }
  }
};


const PROTO_PATH = './protos/helloworld/hello_world.proto';
const hello_proto: any = grpc.load(PROTO_PATH).helloworld;
const logger = createLogger(loggerConfig.logger);

/**
 * Implementation of sayHello RPC method.
 */
function sayHello(call, callback) {
  // send response via callback from RPC
  callback(null, { message: 'Hello ' + call.request.name + ' ' + call.request.data.toString() });
}

describe('grpc-client test', () => {
  let server;
  let client;
  let helloService;
  before(async function startServer() {
    server = new grpc.Server();
    server.addService(hello_proto.Greeter.service, { sayHello });
    server.bind('localhost:50051', grpc.ServerCredentials.createInsecure());
    server.start();
  });
  after(function stopServer() {
    server.tryShutdown((err, res) => {
      if (err) {
        throw new Error('Error while shutting down the server :' + err);
      }
    });
  });
  it('should connect to server and return response', async function checkEndpoint() {
    const grpcConfig = grpcClientCfg.client.test;
    should.exist(grpcConfig);
    should.exist(grpcConfig.transports);
    should.exist(grpcConfig.loadbalancer);
    should.exist(grpcConfig.publisher);
    should.exist(grpcConfig.endpoints);
    client = new Client(grpcConfig, logger);
    helloService = await client.connect();
    let result = await helloService.sayHello({ name: 'test', data: Buffer.from('message') });
    result.data.message.should.be.equal('Hello test message');
  });
  it('request should timeout', async function checkEndpoint() {
    let result = await helloService.sayHello({
      name: 'test',
      data: Buffer.from('message')
    },
      {
        // timeout in milliseconds
        timeout: 0,
        // number of retry attempts
        retry: 2
      });
    should.exist(result.error);
    result.error.message.should.be.equal('deadline exceeded');
    await client.end();
  });
});
