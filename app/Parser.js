const StatsD = require('node-dogstatsd').StatsD;
const statsD = new StatsD('localhost', 8125);

const parsers = require('./parsers');

module.exports = function(injectedStatsD) {
  const dogStatsD = injectedStatsD || statsD;

  return {
    parse: (log, hostname) => {
      if (log && hostname) {
        Object.keys(parsers).forEach((name) => parsers[name](dogStatsD, log, hostname));
      }
    }
  };
};
