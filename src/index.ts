import { Client } from './microservice/client';
export { Client };
export * from './microservice/client';
import * as grpc from './microservice/transport/provider/grpc';
export { grpc };
export { Client as grpcClient } from './microservice/transport/provider/grpc';

import * as _ from 'lodash';
export const toStruct = (obj: any, fromArray = false): any => {
  const decode = (value: any) => {
    let decodedVal;
    if (_.isNumber(value)) {
      decodedVal = { number_value: value };
    }
    else if (_.isString(value)) {
      decodedVal = { string_value: value };
    }
    else if (_.isBoolean(value)) {
      decodedVal = { bool_value: value };
    }
    else if (_.isArray(value)) {
      decodedVal = {
        list_value: {
          values: _.map(value, (v) => {
            return toStruct(v, true);
          })
        }
      };
    }
    else if (_.isObject(value)) {
      decodedVal = { struct_value: toStruct(value) };
    }

    return decodedVal;
  };

  let struct;
  // fromArray flag is true when iterating
  // objects inside a JSON array
  if (!fromArray) {
    struct = {
      fields: {
      },
    };
    _.forEach(obj, (value, key) => {
      struct.fields[key] = decode(value);
    });
  }
  else {
    struct = decode(obj);
  }

  return struct;
};
