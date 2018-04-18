import * as loadbalancer from '../lib/microservice/loadbalancer';
import * as Logger from '@restorecommerce/logger';
import * as should from 'should';

const loggerConfig = {
  logger: {
    console: {
      handleExceptions: false,
      level: 'info',
      colorize: true,
      prettyPrint: true
    }
  }
};
const logger: any = new Logger(loggerConfig.logger);

/* global describe it */

function endpoint(request, context) {
  return {
    result: 'ok',
  };
}

describe('fixed publisher', () => {
  it('should get its input', async function checkFixedPublisher() {
    const endpoints = [endpoint];
    const publisher = await loadbalancer.fixedPublisher(endpoints);
    const ep = await endpoints;
    ep.should.equal(publisher);
  });
});

describe('static publisher', () => {
  const factory = function makeFactory(instance) {
    should.exist(instance);
    instance.should.equal('test');
    return endpoint;
  };
  it('should get the endpoint', async function checkStaticPublisherWithEndpoints() {
    const instances = ['test'];
    const publisher = await loadbalancer.staticPublisher(instances, factory, logger);
    should.exist(publisher);
  });
  it('should throw an error with no instances', async function checkStaticPublisherWithoutEndpoints() {
    try {
      const publisher = loadbalancer.staticPublisher([], factory, logger);
      await publisher;
    } catch (err) {
      should.exist(err);
      err.should.be.Error();
      err.message.should.equal('no endpoints');
    }
  });
});

const tests = [{
  name: 'random',
  loadBalancer(publisher?) {
    return loadbalancer.random(publisher, 1, logger);
  },
}, {
  name: 'roundRobin',
  loadBalancer(publisher?) {
    return loadbalancer.roundRobin(publisher, logger);
  },
}];

tests.forEach((test) => {
  describe(`${test.name} loadBalancer`, () => {
    const zeroEndpoints = [];
    const oneEndpoints = [endpoint];
    const endpoints = [endpoint, endpoint, endpoint];

    describe('with no publisher, calling await', () => {
      it('should throw an error', async () => {
        const lb = await test.loadBalancer().catch((error) => {
          error.message.should.equal('missing publisher');
        });
      });
    });

    describe('with fixedPublisher and three endpoints, calling await',
      async () => {
        const publisher = loadbalancer.fixedPublisher(endpoints);
        const lb = test.loadBalancer(publisher);
        it('should return endpoint', () => {
          should.exist(lb);
        });
        it('should return endpoint value on await',
          async function () {
            const e = await lb;
            should.exist(e);
          });
      });

    describe('with fixedPublisher and one endpoint, calling await', () => {
      const publisher = loadbalancer.fixedPublisher(oneEndpoints);
      const lb = test.loadBalancer(publisher);
      it('should return endpoint', () => {
        should.exist(lb);
      });
      it('should return endpoint value on await',
        async function () {
          const e = await lb;
          should.exist(e);
        });
    });

    describe('with fixedPublisher and zero endpoint, calling await', () => {
      const publisher = loadbalancer.fixedPublisher(zeroEndpoints);
      const lb = test.loadBalancer(publisher);
      it('should throw an error', async function checkGetEndpoint() {
        const result = await lb.catch((error) => {
          error.message.should.equal('publisher did not return endpoints');
        });
        should.not.exist(result);
      });
      it('should throw an error after calling it again',
        async function checkGetEndpoint() {
        const result = await lb.catch((error) => {
          error.message.should.equal('publisher did not return endpoints');
        });
        should.not.exist(result);
      });
    });
  });
});
