Heroku log drain sending data to DataDog
=======

## How it works

The app is a server that receives Heroku logs, parses them then sends parsed data to DataDog.  
You can parse any log coming from Heroku:
 - Heroku's instance logs (database/dyno metrics, requests ...)
 - Console logs from your apps
 - ...

## Setup the app

It is assumed you have at least one [Heroku](https://heroku.com) application and a [DataDog](https://datadoghq.com) account.  
Set this custom log drain up as its own application on Heroku.

```
heroku create --buildpack https://github.com/heroku/heroku-buildpack-multi.git
```

#### DataDog configuration

To get the DataDog relay to run alongside the log-parsing code requires using the [DataDog build pack](https://github.com/DataDog/heroku-buildpack-datadog).

```
heroku config:set HEROKU_APP_NAME=<log drain app name>
heroku config:add DD_API_KEY=<your DataDog API key>
```

#### Authentication

To prevent anyone sending log files to your dyno we use basic auth.

```
heroku config:add BASIC_AUTH_USERNAME=<username>
heroku config:add BASIC_AUTH_PASSWORD=<password>
```

#### Forwarding Heroku logs

To have log files from one app forwarded on to your new log drain set up an [http/s drain](https://devcenter.heroku.com/articles/log-drains#http-s-drains) on any application you want to monitor.

```
heroku drains:add http://<username>:<password>@<log drain app name>.herokuapp.com/logs -a <app>
```

## Custom log parsing

You can create custom parsing routines by adding your parser to `app/parsers`.  
Once your custom parsing file is added, the parser will automatically consider it.

#### Sending data to DataDog

To send data to DataDog, we're using the [node-dogstatsd](https://github.com/mrbar42/node-dogstatsd) package.  
You can refer to the [DataDog metrics page](https://docs.datadoghq.com/developers/metrics/) to understand what the functions represent.


#### Example

You have an Heroku worker running scripts. At the end of each script, you log the script duration in the console:

```javascript
console.log('Successfully ran amazing:job:name in 245 seconds');
```

This produces a log that will be drained to your app. Your app can parse the log and send the script duration to DataDog to plot the script execution duration over time.

```javascript
// app/parsers/custom-parser.js

module.exports = (dogStatsD, log, hostname) => {
  // Parse log line
  const matches = log.match(/info ([a-zA-Z0-9_\.]+) - Successfully ran ([a-z:]+) in ([0-9]+) seconds/);

  if (matches) {
    const [dyno, job, seconds] = matches.slice(-3);

    // Send duration to DataDog
    dogStatsD.gauge('etl.execution_time', parseInt(seconds, 10), [dyno, job]);
  }
}
```
