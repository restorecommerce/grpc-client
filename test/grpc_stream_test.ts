import { Client } from './../lib/microservice/transport/provider/grpc/index';
import * as grpc from 'grpc';
import * as should from 'should';
import * as Logger from '@restorecommerce/logger';
import * as co from 'co';

const grpcClientCfg = {
  client: {
    stream: {
      transports: {
        grpc: {
          service: 'test.Stream',
          protos: [
            'test/test.proto'
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
          'grpc://localhost:50052'
        ]
      },
      endpoints: {
        biStream: {},
        requestStream: {},
        responseStream: {}
      }
    },
  }
};

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

const STREAM_PROTO_PATH = './protos/test/test.proto';
const stream_proto = grpc.load(STREAM_PROTO_PATH).test;
const logger = new Logger(loggerConfig.logger);

async function requestStream(call, callback) {
  const requests = [];
  const fns = [];
  let end = false;
  call.on('data', (req) => {
    if (fns.length) {
      fns.shift()(null, req);
    } else {
      requests.push(req);
    }
  });
  call.on('end', () => {
    end = true;
    while (fns.length) {
      fns.shift()(new Error('stream end'), null);
    }
    fns.push(callback);
    callback(null, 'pong');
  });
}

async function responseStream(call, context) {
  const response = 'pong';
  for (let i = 0; i < 3; i++) {
    call.write(response);
  }
  call.end();
}

async function biStream(call, context) {
  call.on('data', async (req) => {
    call.write({ result: 'pong' });
  });
  call.on('end', () => {
    call.end();
  });
}

describe('grpc-streaming tests', () => {
  let server;
  const grpcConfig = grpcClientCfg.client.stream.transports.grpc;
  const client = new Client(grpcConfig, logger);
  const instance = grpcClientCfg.client.stream.publisher.instances[0];
  before(async function startServer() {
    server = new grpc.Server();
    server.addService(stream_proto.Stream.service, {
      requestStream,
      responseStream, biStream
    });
    server.bind('localhost:50052', grpc.ServerCredentials.createInsecure());
    server.start();
  });
  after(function stopServer() {
    server.tryShutdown((err, res) => {
      if (err) {
        throw new Error('Error while shutting down the server :' + err);
      }
    });
  });
  it('should connect to server and return a response for streaming request',
    async function checkEndpoint() {
      const requestStream = client.makeEndpoint('requestStream', instance);
      let call = await requestStream();
      for (let i = 0; i < 3; i += 1) {
        await call.write({ value: 'ping' });
      }
      let response = await co(call.end((err, data) => { }));
      const data = await new Promise((resolve, reject) => {
        response((err, data) => {
          resolve(data);
          should.exist(data.result);
          data.result.should.equal('pong');
        });
      });
    });

  it('should connect to server and return streaming response for the request',
    async function checkEndpoint() {
      const responseStream = client.makeEndpoint('responseStream', instance);
      let call = await responseStream({ value: 'ping' });
      let streamingResponse = [];
      for (let i = 0; i < 3; i++) {
        // get the EP
        streamingResponse[i] = await co(call.read((err, data) => { }));
        const data = await new Promise((resolve, reject) => {
          streamingResponse[i]((err, data) => {
            resolve(data);
            should.exist(data.result);
            data.result.should.equal('pong');
          });
        });
      }
    });

  it('should connect to server and return streaming response for streaming request',
    async function checkEndpoint() {
      const biStream = client.makeEndpoint('biStream', instance);
      let call = await biStream({ value: 'ping' });
      let result = [];
      for (let i = 0; i < 3; i += 1) {
        await call.write({ value: 'ping' });
      }
      for (let i = 0; i < 3; i += 1) {
        result[i] = await co(call.read((err, data) => { }));
        const data = await new Promise((resolve, reject) => {
          result[i]((err, data) => {
            resolve(data);
            should.exist(data.result);
            data.result.should.equal('pong');
          });
        });
      }
    });
});
