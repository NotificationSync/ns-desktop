#!/usr/bin/env node
const notifier = require('node-notifier');
const inquirer = require('inquirer');
const os = require('os');
const io = require('socket.io-client');
const fs = require('fs');
const path = require('path');
const rp = require('request-promise');
const configFileName = ".ns.conf.json";
const configFilePath = path.join(os.homedir(), configFileName);

if (!fs.existsSync(configFilePath)) {
  var config = new Object();
  inquirer.prompt([
    { type: "input", name: "server", message: "Your server url", default: "https://ns.fornever.org" },
    { type: "input", name: "mail", message: "Your email" }
  ])
    .then(answers => {
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
    });
}
else {
  var config = JSON.parse(fs.readFileSync(configFilePath));
  var ws = io(config.server);

  ws.emit("user/mytoken", { token: config.token });

  ws.on("notification/new", function (notification) {
    console.log(notification);
    notifier.notify({
      title: notification.title,
      message: notification.content
    });
    ws.emit("notification/read", [notification.id])
  })
}

