const shell = require('child_process').exec;

shell('npm install', function (error, stdout, stderr) {
  if (error) {
    console.error(error);
    return;
  }
  shell('npm start', function (error, stdout, stderr) {
    if (error) {
      console.error(error);
      return;
    }
  });
});