const shell = require('child_process').exec;

console.log("Der Update-Cronjob wird eingerichtet...");
shell('echo "0 4 * * * pi node ' + __dirname + '/UPDATE.js\n@reboot pi cd ' + __dirname + ' && npm start " > /etc/cron.d/manosVplan', function (error, stdout, stderr) {
  if (error) {
    console.error(error);
    return;
  }
  console.log("Cronjob installiert!");
});