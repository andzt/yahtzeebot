var SlackClient = require('@slack/client').RtmClient;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var pg = require('pg');
var config = require('./config');

var token = process.env.SLACK_API || config.slack;
var dbURL = process.env.DATABASE_URL || config.db.url;
var client = new SlackClient(token);


pg.connect(dbURL, function(err, client, done) {
});

client.start();

var botId;

////////////////////////////////////////////////////
// Client Events
////////////////////////////////////////////////////

client.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  if(rtmStartData["ok"] === true){
    botId = rtmStartData.self.id;
    console.log(botId);
  }
});

client.on(RTM_CLIENT_EVENTS.RTM_CONNECTION_OPENED, function () {
    
});

////////////////////////////////////////////////////
// RTM Events
////////////////////////////////////////////////////

// create timeout to ping user on delay

client.on(RTM_EVENTS.MESSAGE, function (message) {
  // Listens to all `message` events from the team

  // start game with list of users in turn order in channel
  if(message.type === 'message' && message.text.indexOf(botId) > -1)
  {
    var prefix = '<@' + botId + '>: ';

    if(message.text.indexOf(prefix + 'start') > -1){
      console.log('start!');
    }
    else if(message.text.indexOf(prefix + 'roll') > -1){
      console.log('roll!');
      //// 3 turns - show hand
      //// alert next player
    }
    else if(message.text.indexOf(prefix + 'keep') > -1){
      console.log('keep!');
    }

    else if(message.text.indexOf(prefix + 'help') > -1){
      // send command info
      client.sendMessage('this is a test message', message.channel, function messageSent() {
        // optionally, you can supply a callback to execute once the message has been sent
      });
    }
  }
});

/* GAME OBJECT
Game Id...
Channel Id
Players? 1,2,3,4,5,6
NumPlayers

Current Turn - 1-13 til game over
Current Player Number
Current Roll Number - 1-3
Current Roll Die 1
Current Roll Die 2
Current Roll Die 3
Current Roll Die 4
Current Roll Die 5
Current Hand Die 1
Current Hand Die 2
Current Hand Die 3
Current Hand Die 4
Current Hand Die 5

*/



