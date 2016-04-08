var SlackClient = require('@slack/client').RtmClient;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var pg = require('pg');
var config = require('./config');

var token = process.env.SLACK_API || config.slack;
var dbURL = process.env.DATABASE_URL || config.db.Url;
var client = new SlackClient(token);


pg.connect(process.env.DATABASE_URL, function(err, client, done) {
});

client.start();

var botId;

////////////////////////////////////////////////////
// Client Events
////////////////////////////////////////////////////

client.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  if(rtmStartData["ok"] === true){
    botId = rtmStartData.self.id;
    console.log('connected ' + botId);
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
  console.log(message);

  // start game with list of users in turn order in channel

  // roll command with number of die - default 5 or know how many to roll

  // keep command to keep dice in hand

  //// 3 turns - show hand
  //// alert next player


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



