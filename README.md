# grpc-client

[![Version][version]](https://www.npmjs.com/package/@restorecommerce/grpc-client)[![Build Status][build]](https://travis-ci.org/restorecommerce/grpc-client?branch=master)[![Dependencies][depend]](https://david-dm.org/restorecommerce/grpc-client)[![Coverage Status][cover]](https://coveralls.io/github/restorecommerce/grpc-client?branch=master)

[version]: http://img.shields.io/npm/v/@restorecommerce/grpc-client.svg?style=flat-square
[build]: http://img.shields.io/travis/restorecommerce/grpc-client/master.svg?style=flat-square
[depend]: https://img.shields.io/david/restorecommerce/grpc-client.svg?style=flat-square
[cover]: http://img.shields.io/coveralls/restorecommerce/grpc-client/master.svg?style=flat-square

This module features:

* A Node.js gRPC client based on [grpc](https://github.com/grpc/grpc)
* Uses [Protocol Buffers](https://developers.google.com/protocol-buffers)
to describe both the service interface and the structure of the payload messages
* Failing endpoints are handled using a retry mechanism (see [async-retry](https://github.com/zeit/async-retry))
* The client's communication process is designed to support different types of middlewares and load balancing strategies such as `Random` and `RoundRobin`.

## Configuration

A client instance requires a configuration object and optionally a [winston](https://github.com/winstonjs/winston) compatible logger. Configuration info should include transport-specific details (such as protobuf interfaces) and the names of the endpoints which it is aimed to connect to. For detailed grpc client configuration refer [grpc_test](./test/grpc_test.ts).

## Customization

Although the main transport is gRPC, the client's configuration options are flexible enough to support other transports, which would have to be implemented extending the [Client](https://github.com/restorecommerce/grpc-client/blob/master/src/microservice/client.ts) class to handle that specific transport. The same is true for custom load balancers.

## Development

### Tests

For a simple example on how to use this client with a generic gRPC server check the [test cases](https://github.com/restorecommerce/grpc-client/tree/master/test). The `connect` method as well as all exposed RPC calls are async.

- To run tests

```sh
npm run test
```

## Usage

- Install dependencies

```sh
npm install
```

- Build

```sh
# compile the code
npm run build
```
