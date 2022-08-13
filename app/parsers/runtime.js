const { createDatadogTags } = require('../helpers')
const winston = require('winston');

module.exports = (dogStatsD, log, hostname) => {
  const metricRegexes = {
    active_connections: /sample#active-connections=([0-9\.]*)/,
    waiting_connections: /sample#waiting-connections=([0-9\.]*)/,
    load_avg_1m: /sample#load[-_]avg[-_]1m=([0-9\.]*)/,
    table_cache_hit_rate: /sample#table-cache-hit-rate=([0-9\.]*)/,
    index_cache_hit_rate: /sample#index-cache-hit-rate=([0-9\.]*)/,
    db_size: /sample#db_size=([0-9\.]*)/,
    read_iops: /sample#read-iops=([0-9\.]*)/,
    write_iops: /sample#write-iops=([0-9\.]*)/,
    wal_percentage_used: /sample#wal-percentage-used=([0-9\.]*)/,
    memory_total: /sample#memory[-_]total=([0-9\.]*)/,
    memory_postgres: /sample#memory[-_]postgres=([0-9\.]*)/,
    memory_rss: /sample#memory_rss=([0-9\.]*)/,
    memory_cache: /sample#memory_cache=([0-9\.]*)/,
    memory_swap: /sample#memory_swap=([0-9\.]*)/,
    memory_quota: /sample#memory_quota=([0-9\.]*)/,
  }

  Object.keys(metricRegexes).forEach(function (metric) {
    const matches = log.match(metricRegexes[metric])
    if (matches) {
      value = matches[1]
      instance = log.match(/source=([a-zA-Z0-9_\.]+)/)
      if (instance) {
        const tags = createDatadogTags({
          hostname,
          instance: instance[1].toLowerCase(),
        })

        var type = log.match(/host (app|heroku) ([a-zA-Z-]+)(..)? -/)
        if (type) {
          type = type[2].toLowerCase()
          winston.info(`metric: ${[ type, metric ].join('.')}, value: ${value}, tags: ${tags}`)
          dogStatsD.gauge([ type, metric ].join('.'), value, tags)
        }
      }
    }
  })
}

// Exemple des logs
// source=HEROKU_POSTGRESQL_GREEN addon=postgresql-symmetrical-49064 sample#current_transaction=172211009 sample#db_size=2981352095bytes sample#tables=52 sample#active-connections=172 sample#waiting-connections=0 sample#index-cache-hit-rate=0.99474 sample#table-cache-hit-rate=0.97514 sample#load-avg-1m=0.045 sample#load-avg-5m=0.055 sample#load-avg-15m=0.05 sample#read-iops=0.11111 sample#write-iops=1.8778 sample#tmp-disk-used=33849344 sample#tmp-disk-available=72944943104 sample#memory-total=8173704kB sample#memory-free=729760kB sample#memory-cached=6020224kB sample#memory-postgres=752480kB sample#wal-percentage-used=0.06636223672662293
// source=web.15 dyno=heroku.192609889.c007cbff-41d8-4b1a-98fa-1eb5660b0d79 sample#load_avg_1m=0.54 sample#load_avg_5m=0.35 sample#load_avg_15m=0.37
// source=worker.2 dyno=heroku.192609889.2e8f2e15-9597-40e1-9a89-9e1b1ee8c43c sample#memory_total=212.84MB sample#memory_rss=205.50MB sample#memory_cache=7.34MB sample#memory_swap=0.00MB sample#memory_pgpgin=388793pages sample#memory_pgpgout=335329pages sample#memory_quota=512.00MB
