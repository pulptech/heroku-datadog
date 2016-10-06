var StatsD = require('node-dogstatsd').StatsD;
var statsD = new StatsD('localhost', 8125);

module.exports = function(injectedStatsD) {

	var dogStatsD = injectedStatsD || statsD;

	function parse(log, hostname) {
		if (log, hostname) {
			parseStatus(log, hostname);
			parseException(log, hostname);
			parseHerokuError(log, hostname);
			parseRuntime(log, hostname);

			dogStatsD.increment('logsParsed');
		}
	}

	function parseStatus(log, hostname) {
		var statusMatch = log.match(/status=([0-9]*)/);

		if (statusMatch) {

			var status = statusMatch[1];

			if ((status == "503") && (log.indexOf("code=H18") > -1) && (log.indexOf("sock=client") > -1)) {
				return;
			}

			if (status != "500") {
				status = status.charAt(0) + "xx";
			}

			var service = 0;
			if (log.match(/service=([0-9]*)ms/)) service = Number(log.match(/service=([0-9]*)ms/)[1]);

			var host = "";
			if (log.match(/host=([a-zA-Z\.]*)/)) host = log.match(/host=([a-zA-Z\.]*)/)[1];

			dogStatsD.timing(host + '.serviceTime', service);
			dogStatsD.increment(host + '.status.' + status);

		}
	}

	function parseException(log, hostname) {
		var measureMatch = log.match(/Error: /);

		if (measureMatch) {

			var exceptionType = "Unknown";
			if (log.match(/ - ([a-zA-Z]*):/)) exceptionType = log.match(/ - ([a-zA-Z]*):/)[1];

			dogStatsD.increment("Exception");
			dogStatsD.increment("Exception." + exceptionType);
			console.log("Error: ", log);
		}
	}

	function parseHerokuError(log, hostname) {
		var herokuErrorMatch = log.match(/at=error/);

		if (herokuErrorMatch) {

			var errorCode = "xx";
			if (log.match(/code=H([0-9]*)/)) errorCode = Number(log.match(/code=H([0-9]*)/)[1]);

			var host = "";
			if (log.match(/host=([a-zA-Z\.]*)/)) host = log.match(/host=([a-zA-Z\.]*)/)[1];

			dogStatsD.increment(host + ".HerokuError.H" + errorCode);


			// We don't care about client-side socket hangups
			if ((log.indexOf("code=H18") > -1) && (log.indexOf("sock=client") > -1)) {
				return;
			}
			console.log("Heroku Error: ", log);

		}
	}

	function parseRuntime(log, hostname) {
		var metricRegexes = {
			active_connections: /sample#active-connections=([0-9\.]*)/,
			waiting_connections: /sample#waiting-connections=([0-9\.]*)/,
			load_avg_1m: /sample#load[-_]avg[-_]1m=([0-9\.]*)/,
			table_cache_hit_rate: /sample#table-cache-hit-rate=([0-9\.]*)/,
			index_cache_hit_rate: /sample#index-cache-hit-rate=([0-9\.]*)/,
			db_size: /sample#db_size=([0-9\.]*)/
		};

		Object.keys(metricRegexes).forEach(function(metric) {
			var matches = log.match(metricRegexes[metric]);
			var host = null;
			var instance = null;
			var value = null;
			if (matches) {
				value = matches[1];
				instance = log.match(/source=([a-zA-Z0-9_\.]+)/);
				if (instance) {
					instance = instance[1].toLowerCase();
					type = log.match(/host (app|heroku) ([a-zA-Z-]+)(..)? -/);
					if (type) {
						type = type[2].toLowerCase();
						dogStatsD.gauge([type, metric].join('.'), value, [hostname, instance]);
					}
				}
			}
		});
	}

	return {
		parse: parse
	};
};