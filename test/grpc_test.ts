import { Client } from './../lib/microservice/client';
import * as grpc from 'grpc';
import * as should from 'should';
import * as Logger from '@restorecommerce/logger';

const grpcClientCfg = {
  client: {
    test: {
      transports: {
        grpc: {
          service: "helloworld.Greeter",
          protos: [
            "helloworld/hello_world.proto"
          ],
          protoRoot: "protos/",
          timeout: 3000
        }
      },
      loadbalancer: {
        name: "roundRobin"
      },
      publisher: {
        name: "static",
        instances: [
          "grpc://localhost:50051"
        ]
      },
      endpoints: {
        sayHello: {
          loadbalancer: {
            name: "random",
            seed: 0
          },
          publisher: {
            name: "static",
            instances: [
              "grpc://localhost:50051"
            ]
          }
        }
      }
    }
  }
};

const loggerConfig = {
  logger: {
    console: {
      handleExceptions: false,
      level: "info",
      colorize: true,
      prettyPrint: true
    }
  }
};


const PROTO_PATH = './protos/helloworld/hello_world.proto';
const hello_proto = grpc.load(PROTO_PATH).helloworld;
const logger = new Logger(loggerConfig.logger);
let server;
/**
 * Implements the sayHello RPC method.
 */
function sayHello(call, callback) {
  // send response via callback from RPC
  callback(null, { message: 'Hello ' + call.request.name });
}

describe('grpc-client test', () => {
  before(async function startServer() {
    server = new grpc.Server();
    server.addService(hello_proto.Greeter.service, { sayHello: sayHello });
    server.bind('localhost:50051', grpc.ServerCredentials.createInsecure());
    server.start();
  });
  after(function stopServer() {
    server.tryShutdown((err, res) => {
      if (err) {
        throw new Error('Error while shutting down the server :' + err)
      }
    })
  });
  it('should connect to server and return response', async function checkEndpoint() {
    const grpcConfig = grpcClientCfg.client.test;
    should.exist(grpcConfig);
    should.exist(grpcConfig.transports);
    should.exist(grpcConfig.loadbalancer);
    should.exist(grpcConfig.publisher);
    should.exist(grpcConfig.endpoints);
    let client = new Client(grpcConfig, logger);
    const helloService = await client.connect();
    let result = await helloService.sayHello({ name: 'test' });
    result.data.message.should.be.equal('Hello test');
    await client.end();
  });
});
