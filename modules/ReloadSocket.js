var config = require('.././package').config

var server = require('http').createServer()
var io = require('socket.io')(server)

server.listen(config.socket_port)

var reload = function (type) {
  io.emit('reload', {
    type: type
  })
}

module.exports = reload
