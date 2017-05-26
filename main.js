#!/usr/bin/env node

const notifier = require('node-notifier');
const inquirer = require('inquirer');
const os = require('os');
const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const rp = require('request-promise');
const commander = require('commander');
const validator = require('validator');
const meta = require('./package');
const configFileName = ".ns.conf.json";
const configFilePath = path.join(os.homedir(), configFileName);


commander
  .version(meta.version)
  .option('-r, --reset', 'reset client config')
  .parse(process.argv);

if (commander.reset) {
  if (fs.existsSync(configFilePath))
    fs.unlinkSync(configFilePath);
}

if (!fs.existsSync(configFilePath)) {
  var config = new Object();
  inquirer.prompt([
    { type: "input", name: "server", message: "Your server url", default: "https://ns.fornever.org" },
    { type: "input", name: "mail", message: "Your email" }
  ])
    .then(answers => {
      if (!validator.isEmail(answers.mail)) {
        throw new Error("Enter correct email address");
      }
      if (!validator.isURL(answers.server)) {
        throw new Error("Enter correct server url");
      }
      Object.assign(config, answers);
      var tokenUri = `${answers.server}/api/v1/user/token`;
      return rp({
        uri: tokenUri,
        method: "POST",
        body: {
          mail: answers.mail
        },
        json: true
      })
    })
    .then(() => {
      return inquirer.prompt([{
        type: "input",
        name: "token",
        message: "Your token (check your mailbox)"
      }]);
    })
    .then(answers => {
      Object.assign(config, answers);
      fs.writeFileSync(configFilePath, JSON.stringify(config));
    })
    .then(()=>{
      startNotificationSyncClient();
    })
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
} else {
  startNotificationSyncClient()
}

function startNotificationSyncClient() {

  var config = JSON.parse(fs.readFileSync(configFilePath));
  var ws = io(config.server, { forceNew: true });

  ws.on("connect", function () {

    console.log('Connected');

    ws.emit("user/mytoken", { token: config.token }, function (msg) {

      ws.emit("notification/unread", {}, function (notifications) {
        if (notifications) {
          var ids = _.map(notifications, notification => {
            notifier.notify({
              title: notification.title,
              message: notification.content
            });
            return notification.id;
          });
          ws.emit("notification/read", ids);
        }
      });

      ws.on("notification/new", function (notification) {
        notifier.notify({
          title: notification.title,
          message: notification.content
        });
        ws.emit("notification/read", [notification.id])
      });


    });

  })

  ws.on('disconnect', function () {
    console.log('Disconnected');
  });

}