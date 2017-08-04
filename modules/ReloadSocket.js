const config = require('.././package').config

const server = require('http').createServer()
const io = require('socket.io')(server)

server.listen(config.socket_port)

const reload = (type) => {
  io.emit('reload', {
    type,
  })
}

module.exports = reload
