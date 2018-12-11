A custom log drain sending Heroku logs to DataDog
=======

## Setup

It is assumed you have at least one Heroku application and a DataDog account.  
Set this custom log drain up as its own application on Heroku.

```
heroku create --buildpack https://github.com/heroku/heroku-buildpack-multi.git
```

### DataDog

To get the DataDog relay to run alongside the log-parsing code requires using the [DataDog build pack](https://github.com/DataDog/heroku-buildpack-datadog).

```
heroku config:set HEROKU_APP_NAME=<log drain app name>
heroku config:add DD_API_KEY=<your Datadog API key>
```

## BasicAuth

To prevent anyone sending log files to your dyno we use basic auth.

```
heroku config:add BASIC_AUTH_USERNAME=<username>
heroku config:add BASIC_AUTH_PASSWORD=<password>
```

### Forward Logs

To have log files from one app forwarded on to your new log drain set up an [http/s drain](https://devcenter.heroku.com/articles/log-drains#http-s-drains) on any application you want to monitor.

```
heroku drains:add http://<username>:<password>@<log drain app name>.herokuapp.com/logs -a <app>
```

## Custom log parsing

You can create custom parsing routines by adding your parser to `app/parsers`.  
Once your custom parsing file is added, the parser will automatically consider it.
