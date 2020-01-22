/**
 * fixedPublisher yields a set of fixed endpoints provided to it.
 *
 * @param  {array.Promise} endpoints   Fixed endpoints.
 */
export const fixedPublisher = async (endpoints: any): Promise<any> => {
  const value = await (endpoints);
  return value;
};
