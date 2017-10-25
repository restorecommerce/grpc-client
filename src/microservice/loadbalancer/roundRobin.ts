'use strict';

import * as co from "co";

async function send(publisher: any, counter: any): Promise<any> {
  const p = publisher.next();
  if (p.done) {
    throw new Error('publisher is done');
  }
  const endpoints = await p.value;
  if (!endpoints || endpoints.length === 0) {
    throw new Error('publisher did not return endpoints');
  }
  return endpoints[counter % endpoints.length];
}

/**
 * roundRobin is a simple load balancer that returns each of the published endpoints in sequence
 *
 * @param  {generator} publisher An endpoint publisher.
 */
export async function roundRobin(publisher: any): Promise<any> {
  if (!publisher) {
    throw new Error('missing publisher');
  }
  let counter = 0;
  while (publisher !== undefined) {
    await co(send(publisher, counter)).catch((err) => {
      throw err;
    });
    counter += 1;
  }
}

// module.exports.roundRobin = roundRobin;
