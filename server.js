const express = require('express');
const auth = require('basic-auth');
const Redis = require('ioredis');
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '.env'),
});
const winston = require('winston');

const Parser = require("./app/Parser");
const { redisUrl } = require('./configuration/index');
const TimeoutLogParserHandler = require('./app/TimeoutLogParserHandler');
const loggerConfiguration = require('./configuration/logger');

loggerConfiguration.configureLogger();

const app = express();

app.use(function(req, res, next) {
  const user = auth(req);

  if (user === undefined || user['name'] !== process.env.BASIC_AUTH_USERNAME || user['pass'] !== process.env.BASIC_AUTH_PASSWORD) {
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="AuthRealm"');
    res.end('Unauthorized');
    winston.info('Received Unauthorized request', { path: req.originalUrl, user });
  } else {
    next();
  }
});

app.use(function(req, res, next) {
  let data = '';
  req.on('data', function(chunk) {
    data += chunk
  })
  req.on('end', function() {
    req.body = data;
    next();
  });
});

const redisSingleton = new Redis(redisUrl);
const parser = new Parser();
const timeoutLogParserHandler = new TimeoutLogParserHandler({ redisSingleton });
timeoutLogParserHandler.startHandler();

app.get('/', function(request, response) {
  response.send('OK');
});

app.post('/logs', function(request, response) {
  response.sendStatus(200);
  if (request.get('content-type') == 'application/logplex-1') {

    const hostname = request.hostname;
    const logArray = request.body.split("\n");
    logArray.forEach(function(log) {
      parser.parse(log, hostname);
    });

     timeoutLogParserHandler.addNewLogBatch({ logArray })
  } else {
    winston.info('Not Logplex');
  }
});

app.post('/monitors', function(request, response) {
  response.sendStatus(200);
  winston.info('Received Datadog callback', { body: request.body });
});

winston.info('Starting the log monitoring server');
const port = process.env.PORT || 3000;
app.listen(port, function() {
  winston.info('Listening on port: ' + port);
});
