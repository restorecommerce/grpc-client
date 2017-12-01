# grpc-client

A node.js Client for gRPC based on [grpc](https://github.com/grpc/grpc).
The Client uses [Protocol Buffers](https://developers.google.com/protocol-buffers)
as the interface definition language for describing both the service interface and the structure of the payload messages.
An endpoint is an exposed service function of server and transport communicates between a Server and Client. Clients connect to Servers via transports and provides endpoints. When calling an endpoint the Client request traverses through possible middleware, retry and timeout logic, load balancing and finally it reaches the transport. The transport encodes the request and sends it to the server. The response from the server is directly provided as a result or as an error.

## Middleware

The Client request traverses middleware before calling the endpoint. The middleware can call the next middleware until the last middleware calls the endpoint.

## Retry

Failing endpoints retry calling with retry mechanism.
For the retry logic we use [async-retry](https://github.com/zeit/async-retry).
See test case for more details.

## Timeout

It is possible to add a timeout to an endpoint call. The timeout number is in milliseconds. See test case for more details.

## Publisher

A publisher provides endpoints to a loadbalancer. Most publisher call a factory function to generate an endpoint from an instance.

Publishers:
- FixedPublisher
- StaticPublisher

## LoadBalancer

A loadbalancer picks an endpoint from the publisher. Which endpoint gets selected depends on it's strategy.

LoadBalancers:
- Random
- RoundRobin

## Transport

A transport communicates between a server and a client. It handles encoding/decoding of data and sending/receiving. The following transport providers are available:

- gRPC (Client-Server)
- pipe (in-process communication, designed for testing)

## Usage

WIP test.ts