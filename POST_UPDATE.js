const shell = require('child_process').exec

const https = require('https')
const querystring = require('querystring')
const moment = require('moment')

console.log('Das neue Update wird nun installiert...')
shell('npm install', (error) => {
  if (error) {
    console.error(error)
    return
  }
  console.log('Es wird versucht das neue System zu starten...')
  shell('npm start', (error) => {
    if (error) {
      console.error(error)
      return
    }
    console.log('Starten erfolgreich!')
    console.log('Das System wurde erfolgreich geupdatet!')

    // SEND PUSHOVER


    const postBody = querystring.stringify({
      token: 'a7d78cherf7xjw8cyzb5ohjeck4fzi',
      user: 'uosg3juoskcsjpfhiw7htjjn8iejyg',
      message: `System successfully updated!\n${moment().format('dddd, MMMM Do YYYY, h:mm:ss a')}`,
    })

    const options = {
      hostname: 'api.pushover.net',
      port: 443,
      path: '/1/messages.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postBody),
      },
    }

    const req = https.request(options, (res) => {
      console.log('statusCode:', res.statusCode)

      res.on('data', (d) => {
        console.log(d.toString('utf8'))
      })
    })

    req.on('error', (e) => {
      console.error(e)
    })
    req.write(postBody)
    req.end()

    // SEND PUSHOVER
  })
})
