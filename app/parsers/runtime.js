const { createDatadogTags } = require('../helpers');

module.exports = (dogStatsD, log, hostname) => {
  const metricRegexes = {
    active_connections: /sample#active-connections=([0-9\.]*)/,
    waiting_connections: /sample#waiting-connections=([0-9\.]*)/,
    load_avg_1m: /sample#load[-_]avg[-_]1m=([0-9\.]*)/,
    table_cache_hit_rate: /sample#table-cache-hit-rate=([0-9\.]*)/,
    index_cache_hit_rate: /sample#index-cache-hit-rate=([0-9\.]*)/,
    db_size: /sample#db_size=([0-9\.]*)/,
    memory_total: /sample#memory[-_]total=([0-9\.]*)/,
    memory_rss: /sample#memory_rss=([0-9\.]*)/,
    memory_cache: /sample#memory_cache=([0-9\.]*)/,
    memory_swap: /sample#memory_swap=([0-9\.]*)/,
    memory_quota: /sample#memory_quota=([0-9\.]*)/
  };

  Object.keys(metricRegexes).forEach(function(metric) {
    const matches = log.match(metricRegexes[metric]);
    if (matches) {
      value = matches[1];
      instance = log.match(/source=([a-zA-Z0-9_\.]+)/);
      if (instance) {
        const tags = createDatadogTags({
          hostname,
          instance: instance[1].toLowerCase()
        });

        type = log.match(/host (app|heroku) ([a-zA-Z-]+)(..)? -/);
        if (type) {
          type = type[2].toLowerCase();
          console.log([type, metric].join('.'), value, tags);
          dogStatsD.gauge([type, metric].join('.'), value, tags);
        }
      }
    }
  });
};
