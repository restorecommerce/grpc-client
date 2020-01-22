import * as Random from 'random-js';

const send = async(publisher: any, rnd: any): Promise<any> => {
  const endpoints = await (publisher);
  if (!endpoints || endpoints.length === 0) {
    throw new Error('publisher did not return endpoints');
  }
  const m = Math.max(endpoints.length - 1, 0);
  return endpoints[rnd.integer(0, m)];
};


/**
 * random is a simple load balancer that returns a randomly selected endpoint;
 *
 * @param  publisher An endpoint publisher.
 * @param  seed      Seed for random generator.
 */
export const random = async(publisher: any, seed: number, logger: any): Promise<any> => {
  if (!publisher) {
    throw new Error('missing publisher');
  }
  const rnd = new Random(Random.engines.mt19937().seed(seed));
  const randomValue = await send(publisher, rnd);
  return randomValue;
};
