var express = require('express');
var http = require('http');
var app = require('express')()
  , server = http.createServer(app);

server.listen(3001);

//routing
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});
app.get('/bdb/:required/:optional?/:optional2?', function(req, res) {
  var options = {
    host: 'api.brewerydb.com',
    path: req.url.replace('/bdb', '/v2') + '&key=30fd5a962baea2c9c2e9ccf1a7538757',
    method: 'GET',
    headers: {'Content-Type': 'application/json'}
  };

  var proxyReq = http.request(options, function(proxyRes) {
      var output = '';
      proxyRes.setEncoding('utf8');

      proxyRes.on('data', function (chunk) {
          output += chunk;
      });

      proxyRes.on('end', function() {
          var obj = JSON.parse(output);
          res.json(obj);
      });
  });
  
  proxyReq.on('error', function(err) {
      console.log(err);
  });

  proxyReq.end();
});
app.use(express.static(__dirname + '/public'));