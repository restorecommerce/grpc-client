import * as co from 'co';
import { fixedPublisher } from './fixedPublisher';

/**
 * StaticPublisher yields a set of static endpoints as produced by the passed factory.
 *
 * @param  {Array.<string>} instances Typically host:port strings
 * which the factory converts into endpoints.
 * @param  factory   Converts instance strings into endpoints.
 * @param  {Object} logger
 */
const staticPublisher = async(instances: string[], factory: any,
  logger: any): Promise<any> => {
  // async function send
  const endpoints = co(async(): Promise<any> => {
    const epoints = [];
    for (let i = 0; i < instances.length; i += 1) {
      const instance = instances[i];
      try {
        const e = factory(instance);
        epoints.push(e);
      } catch (err) {
        logger.error('factory', instance, 'err', err);
      }
    }
    if (epoints.length === 0) {
      throw new Error('no endpoints');
    }
    logger.debug(`staticPublisher provides ${epoints.length} endpoint(s)
      from ${instances.length} instance(s)`, { instances });
    // epoints refers to the factory method i.e. generalFactory in client.ts
    return await epoints;
  }).catch((err) => {
    throw err;
  });
  return await fixedPublisher(endpoints);
};

export { staticPublisher as staticPublisher };
