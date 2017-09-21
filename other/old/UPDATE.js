const https = require('https')
const fs = require('fs')
const path = require('path')
const shell = require('child_process').exec

const options = {
  hostname: 'api.github.com',
  port: 443,
  path: '/repos/DrJume/manosVplan/releases/latest',
  method: 'GET',
  headers: {
    'User-Agent': 'DrJume',
  },
}


function versionCompare(neu, derzeit) {
  const pa = neu.split('.')
  const pb = derzeit.split('.')
  for (let i = 0; i < 3; i += 1) {
    const na = Number(pa[i])
    const nb = Number(pb[i])
    if (na > nb) return 1
    if (nb > na) return -1
    if (!isNaN(na) && isNaN(nb)) return 1
    if (isNaN(na) && !isNaN(nb)) return -1
  }
  return 0
}

function isNewerVersion(neu, derzeit) {
  if (versionCompare(neu, derzeit) > 0) {
    return true
  }
  return false
}

function doTheUpdateProcess(tarballUrl, neuVer) {
  const newFolderName = `manosVplan-${neuVer}`
  shell(`mkdir ${newFolderName}`, {
    cwd: path.join(__dirname, '/../'),
  }, (error) => {
    if (error) {
      console.error(error)
      return
    }
    console.log('Das Update wird herunterladen...')
    shell(`wget -qO- ${tarballUrl} | tar xvz -C ../${newFolderName} --strip-components 1`, (error) => {
      if (error) {
        console.error(error)
        return
      }
      console.log('Es wird versucht das alte System abzuschalten...')
      shell('npm stop', (error) => {
        if (error) {
          console.error(error)
        }
        console.log('Starten der Nach-Update Prozedur...')
        shell('node POST_UPDATE.js', {
          cwd: path.join(__dirname, '/../', newFolderName, '/'),
        }, (error, stdout) => {
          console.log(stdout)
        })
      })
    })
  })
}

function response(res) {
  console.log(res)
  fs.readFile(path.join(__dirname, '/VERSION'), 'utf-8', (err, data) => {
    if (err) {
      console.error('Derzeitige Version konnte nicht gelesen werden!')
      console.error(err)
      return
    }
    let readableTagName = ''
    readableTagName = res.tag_name.slice(1)
    readableTagName = readableTagName.split('-')[0]
    console.log(`${readableTagName} neuer als ${data} ? --> ${isNewerVersion(readableTagName, data)}`)
    if (isNewerVersion(readableTagName, data)) {
      console.log('Eine neue Version des Systems ist verfügbar.\nDas Update wird nun installiert...')
      doTheUpdateProcess(res.tarball_url, res.tag_name.slice(1))
    }
  })
}


let str = ''

const req = https.request(options, (res) => {
  res.on('data', (chunk) => {
    str += chunk
  })
  res.on('end', () => {
    if (!(res.statusCode == 200)) {
      console.log('API hat nicht mit 200 (OK) geantwortet!')
      return
    }
    response(JSON.parse(str))
  })
})

req.on('error', (e) => {
  console.error(e)
})
req.end()
