# grpc-client
<img src="http://img.shields.io/npm/v/%40restorecommerce%2Fkafka%2Dclient.svg?style=flat-square" alt="">[![Build Status][build]](https://travis-ci.org/restorecommerce/grpc-client?branch=master)[![Dependencies][depend]](https://david-dm.org/restorecommerce/grpc-client)[![Coverage Status][cover]](https://coveralls.io/github/restorecommerce/grpc-client?branch=master)

[version]: http://img.shields.io/npm/v/grpc-client.svg?style=flat-square
[build]: http://img.shields.io/travis/restorecommerce/grpc-client/master.svg?style=flat-square
[depend]: https://img.shields.io/david/restorecommerce/grpc-client.svg?style=flat-square
[cover]: http://img.shields.io/coveralls/restorecommerce/grpc-client/master.svg?style=flat-square

A Node.js client for gRPC based on [grpc](https://github.com/grpc/grpc) written in [Typescript](https://github.com/Microsoft/TypeScript).
It uses [Protocol Buffers](https://developers.google.com/protocol-buffers)
to describe both the service interface and the structure of the payload messages in order to expose service functions as RPC endpoints to any Node.js application.
Failing endpoints are handled using a retry mechanism (see [async-retry](https://github.com/zeit/async-retry)).
The client's communication process is designed to support different types of middlewares and load balancing strategies. Currently, the supported load balancing strategies are `Random` and `RoundRobin`.

## Usage

The Client requires a gRPC config and optionally a logger should be passed. The logger should be based on the [winston](https://github.com/winstonjs/winston) logging library. For a simple exampel on how to use this client with a generic gRPC server check the [test cases](https://github.com/restorecommerce/grpc-client/tree/master/test). The `connect` method as well as all exposed RPC calls have to be performed `asynchronously`.

## Customization

Although the main transport is gRPC, the client's configuration options are flexible enough to support other transports, which would have to be implemented extending the [Client](https://github.com/restorecommerce/grpc-client/blob/master/src/microservice/client.ts) class to handle that specific transport. The same is true for custom load balancers. Furthermore, service testing can be done without using gRPC / Protocol Buffers, as `pipe` is supported as a transport for in-process communication.
