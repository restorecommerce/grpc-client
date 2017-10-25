'use strict';

/*  eslint-disable require-yield */

import * as co from "co";
// const co = require('co');

/**
 * fixedPublisher yields a set of fixed endpoints provided to it.
 *
 * @param  {array.generator} endpoints   Fixed endpoints.
 */
export async function fixedPublisher(endpoints: any): Promise<any> {
  while (endpoints !== undefined) {
    await co(async function send(): Promise<any> {
      return endpoints;
    });
  }
}

// module.exports.fixedPublisher = fixedPublisher;
