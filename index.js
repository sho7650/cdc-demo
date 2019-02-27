'use strict';

require('sqreen');
require ('newrelic');
// require('appoptics-apm');

var path = require('path');

const jwt = require('jsonwebtoken');
const request = require('request');
const jsforce = require('jsforce');

const express = require('express');
const app = express();

require('dotenv').config();

// define
const TOKEN_ENDPOINT_URL = 'https://login.salesforce.com/services/oauth2/token';

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'))

const secret = Buffer.from(process.env.PRIVATE_KEY.replace(/\\n/g, '\n'));

// server sent event
app.get('/api/accounts/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write("event: status\ndata: connected.\n\n");

  const claim = {
    iss: process.env.ISSUER,
    aud: process.env.AUDIENCE,
    sub: process.env.SUBJECT,
    exp: Math.floor(Date.now() / 1000) + (3 * 60) // 3分
  };
  const token = jwt.sign(claim, secret, { algorithm: 'RS256' });
  const post = {
    method: 'POST',
    url: TOKEN_ENDPOINT_URL,
    form: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token
    }
  };

  request(post, function (err, response, body) {
    if (err) {
      return console.error(err);
    }
    var ret = JSON.parse(body);
    var conn = new jsforce.Connection({
      accessToken: ret.access_token,
      instanceUrl: ret.instance_url
    });
    const ping = () => {
      res.write("event: status\ndata: ping\n\n");
    }
    res.write("event: status\ndata: connected to Salesforce\n\n");
    conn.streaming.topic(process.env.TOPIC).subscribe((message) => {
      res.write(`data: ${JSON.stringify(message)}`);
      res.write("\n\n");
    });
    setInterval(ping, 45000);
  });
});

/*
app.get('/', (req, res) => {
  res.render('index');
});
*/

app.listen(process.env.PORT || 3000, () => console.log('starting with port 3000'));