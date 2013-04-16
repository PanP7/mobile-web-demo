var express = require('express');
var app = require('express')()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

server.listen(3000);

//routing
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});
app.use(express.static(__dirname + '/public'));