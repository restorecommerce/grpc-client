import { Client } from './microservice/client';
export { Client };
export * from './microservice/client';
import * as grpc from './microservice/transport/provider/grpc';
export { grpc };
export { Client as grpcClient } from './microservice/transport/provider/grpc';
export { Client as pipeClient } from './microservice/transport/provider/pipe';
