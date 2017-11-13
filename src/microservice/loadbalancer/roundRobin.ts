async function send(publisher: any, counter: any): Promise<any> {
  const endpoints = await (publisher);
  if (!endpoints || endpoints.length === 0) {
    throw new Error('publisher did not return endpoints');
  }
  return endpoints[counter % endpoints.length];
}

/**
 * roundRobin is a simple load balancer that returns each of the published endpoints in sequence
 *
 * @param  publisher An endpoint publisher.
 */
export async function roundRobin(publisher: any, logger: any): Promise<any> {
  if (!publisher) {
    throw new Error('missing publisher');
  }
  let counter = 0;
  return await (send(publisher, counter));
}
