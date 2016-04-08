var SlackClient = require('@slack/client').RtmClient;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var pg = require('pg');
var config = require('./config');
var orm = require("orm");


var token = process.env.SLACK_API || config.slack;
var dbURL = process.env.DATABASE_URL || config.db.url;
var client = new SlackClient(token);
var botId;
var GameDB;

////////////////////////////////////////////////////
// Startup
////////////////////////////////////////////////////

orm.connect(dbURL, function (err, db) {
  if (err) throw err;

  GameDB = db.define("game", {
      id        : { type: 'serial', key: true },
      channelId  : String,
      numPlayers: Number, // max 8
      player1   : String,
      player2   : String,
      player3   : String,
      player4   : String,
      player5   : String,
      player6   : String,
      player7   : String,
      player8   : String,
      currentTurn   : Number, // 1-14 14 is game over
      currentPlayer : Number,
      currentRoll   : Number,
      currentRoll1  : Number,
      currentRoll2  : Number,
      currentRoll3  : Number,
      currentRoll4  : Number,
      currentRoll5  : Number

    }, {
        methods: {
            fullName: function () {
                return this.id;
            }
        },
        validations: {
        }
    });

    // add the table to the database
  db.sync(function(err) { 
      if (err) throw err;
  });
});

client.start();

////////////////////////////////////////////////////
// Client Events
////////////////////////////////////////////////////

client.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  if(rtmStartData["ok"] === true){
    botId = rtmStartData.self.id;
  }
});

client.on(RTM_CLIENT_EVENTS.RTM_CONNECTION_OPENED, function () {
    
});

////////////////////////////////////////////////////
// RTM Events
////////////////////////////////////////////////////

client.on(RTM_EVENTS.MESSAGE, function (message) {
  // Listens to all `message` events from the team

  // start game with list of users in turn order in channel
  if(message.type === 'message' && message.text.indexOf(botId) > -1)
  {
    var prefix = '<@' + botId + '>: ';
    // Start game
    if(message.text.indexOf(prefix + 'start') > -1){
      var commandLength = (prefix + 'start').length;
      var params = message.text.substr(commandLength, message.text.length-commandLength).trim();

      //find if there's already a game
      GameDB.find({ channelId: message.channel }, function (err, games) {
        if (err) throw err;

        if(games.length === 0 || games[0].currentTurn === 14){ // or end game turn is 14
          if(games.length > 0){
            // Delete old games..
            GameDB.find({ channelId: message.channel }).remove();
          }

          var players = params.split(" ");

          if(players.length > 1 && players.length < 9){
            GameDB.create(
              { 
                channelId: message.channel,  
                numPlayers: players.length, 
                player1: players[0],
                player2: players.length >= 2 ? players[1] : '',
                player3: players.length >= 3 ? players[2] : '',
                player4: players.length >= 4 ? players[3] : '',
                player5: players.length >= 5 ? players[4] : '',
                player6: players.length >= 6 ? players[5] : '',
                player7: players.length >= 7 ? players[6] : '',
                player8: players.length >= 8 ? players[7] : '',
                currentTurn: 0, 
                currentPlayer: 0, 
                currentRoll: 0 
              }, 
              function(err) {
                if (err) throw err;
                client.sendMessage('Starting game...', message.channel);

                GameDB.find({ channelId: message.channel, currentTurn: 0 }, function (err, games) {
                  if (err) throw err;

                  if (games.length > 0){
                    notifyNextPlayer(games[0], client);
                  }
                });
              }
            );
          }else{
            client.sendMessage('Too many or too few players... must be 1 or less than 8', message.channel);
          }
        }else{
          client.sendMessage('Game in progress!', message.channel);
        }
      });
    }
    // Turn Roll logic
    else if(message.text.indexOf(prefix + 'roll') > -1){
      var commandLength = (prefix + 'roll').length;
      var params = message.text.substr(commandLength, message.text.length-commandLength).trim();
      GameDB.find({ channelId: message.channel, currentTurn: 0 }, function (err, games) {
        if (err) throw err;

        if(games.length < 1)
          return;

        var userId = '<@' + message.user + '>';
        var playerId = '';

        if(games[0].currentPlayer == 1){
          playerId = games[0].player1;
        }else if (games[0].currentPlayer == 2){
          playerId = games[0].player2;
        }else if (games[0].currentPlayer == 3){
          playerId = games[0].player3;
        }else if (games[0].currentPlayer == 4){
          playerId = games[0].player4;
        }else if (games[0].currentPlayer == 5){
          playerId = games[0].player5;
        }else if (games[0].currentPlayer == 6){
          playerId = games[0].player6;
        }else if (games[0].currentPlayer == 7){
          playerId = games[0].player7;
        }else if (games[0].currentPlayer == 8){
          playerId = games[0].player8;
        }

        if(playerId === userId){
          // count unused dice spots
          var count = games[0].currentRoll1 === 0 ? 1 : 0;
          count = games[0].currentRoll2 === 0? count + 1 : count; 
          count = games[0].currentRoll3 === 0? count + 1 : count; 
          count = games[0].currentRoll4 === 0? count + 1 : count; 
          count = games[0].currentRoll5 === 0? count + 1 : count; 

          games[0].currentRoll = games[0].currentRoll + 1;

          var dice = rollDice(count);
          console.log(dice);

          for (var i =0; i<count; i++){
            if(5-count+i === 4){
              games[0].currentRoll5 = dice[i];
            }else if(5-count+i === 3){
              games[0].currentRoll4 = dice[i];
            }else if(5-count+i === 2){
              games[0].currentRoll3 = dice[i];
            }else if(5-count+i === 1){
              games[0].currentRoll2 = dice[i];
            }else if(5-count+i === 0){
              games[0].currentRoll1 = dice[i];
            }
          }
          client.sendMessage('Current hand: *' + games[0].currentRoll1 + ' '
            + games[0].currentRoll2 + ' '
            + games[0].currentRoll3 + ' '
            + games[0].currentRoll4 + ' '
            + games[0].currentRoll5
            + '*', message.channel);
          games[0].save();

          if(games[0].currentRoll === 4){
            notifyNextPlayer(games[0], client)
          }

        }
      });
    }
    // Keep Roll logic
    else if(message.text.indexOf(prefix + 'keep') > -1){
      var commandLength = (prefix + 'roll').length;
      var params = message.text.substr(commandLength, message.text.length-commandLength).trim();
      GameDB.find({ channelId: message.channel, currentTurn: 0 }, function (err, games) {
        if (err) throw err;

        if(games.length < 1)
          return;

        var userId = '<@' + message.user + '>';
        var playerId = '';

        if(games[0].currentPlayer == 1){
          playerId = games[0].player1;
        }else if (games[0].currentPlayer == 2){
          playerId = games[0].player2;
        }else if (games[0].currentPlayer == 3){
          playerId = games[0].player3;
        }else if (games[0].currentPlayer == 4){
          playerId = games[0].player4;
        }else if (games[0].currentPlayer == 5){
          playerId = games[0].player5;
        }else if (games[0].currentPlayer == 6){
          playerId = games[0].player6;
        }else if (games[0].currentPlayer == 7){
          playerId = games[0].player7;
        }else if (games[0].currentPlayer == 8){
          playerId = games[0].player8;
        }

        if(playerId === userId){
          // count unused dice spots
          var nums = params.split(' ').join('').split('').map(function(item) {
            return parseInt(item, 10);
          });

          // array of current rolls
          var rolls = [games[0].currentRoll1,games[0].currentRoll2,
            games[0].currentRoll3,games[0].currentRoll4,games[0].currentRoll5];  
          var keep = [];

          console.log(nums);
          console.log(rolls);
          var count = 0;
          while(count < nums.length){
            if(rolls.indexOf(nums[count]) < 0){
              client.sendMessage('Bad Keep. Try again.', message.channel);
              return;
            }
            else {
              keep.push(nums[count]);
              rolls[rolls.indexOf(nums[count])] = 0;
            }
            count++;
          }
          keep.sort();
          console.log(keep);

          games[0].currentRoll1 = 0;
          games[0].currentRoll2 = 0;
          games[0].currentRoll3 = 0;
          games[0].currentRoll4 = 0;
          games[0].currentRoll5 = 0;
          for (var i =0; i<keep.length; i++){
            if(i === 4){
              games[0].currentRoll5 = keep[i];
            }else if(i === 3){
              games[0].currentRoll4 = keep[i];
            }else if(i === 2){
              games[0].currentRoll3 = keep[i];
            }else if(i === 1){
              games[0].currentRoll2 = keep[i];
            }else if(i === 0){
              games[0].currentRoll1 = keep[i];
            }
          }
          games[0].save();
          client.sendMessage('Keeping: *' + keep.join(' ') + '*... Roll again.', message.channel);
        }
      });
    }
    // Display help
    else if(message.text.indexOf(prefix + 'help') > -1){
      // send command info
      client.sendMessage('this is a test message', message.channel, function () {
        // optionally, you can supply a callback to execute once the message has been sent
      });
    }
  }
});

////////////////////////////////////////////////////
// Helper Functions
////////////////////////////////////////////////////

function rollDice(count) {
  var dice = [];
  for (var i = 0; i < Math.min(5, Math.max(1, count)); i++) {
      dice.push(getRandomIntInclusive(1, 6));
  }
  return dice.sort();
}

function getRandomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function notifyNextPlayer(game, client){
  var playerId = '';
  game.currentTurn = game.currentPlayer < game.numPlayers ? game.currentTurn : game.currentTurn + 1;
  game.currentRoll = 1;
  game.currentPlayer = game.currentPlayer < game.numPlayers ? game.currentPlayer + 1 : 1;
  game.currentRoll1 = 0;
  game.currentRoll2 = 0;
  game.currentRoll3 = 0;
  game.currentRoll4 = 0;
  game.currentRoll5 = 0;
  game.save();

  if(game.currentTurn === 14){
    client.sendMessage('GAME OVER', game.channelId);
    game.remove()
  }

  if(game.currentPlayer == 1){
    playerId = game.player1;
  }else if (game.currentPlayer == 2){
    playerId = game.player2;
  }else if (game.currentPlayer == 3){
    playerId = game.player3;
  }else if (game.currentPlayer == 4){
    playerId = game.player4;
  }else if (game.currentPlayer == 5){
    playerId = game.player5;
  }else if (game.currentPlayer == 6){
    playerId = game.player6;
  }else if (game.currentPlayer == 7){
    playerId = game.player7;
  }else if (game.currentPlayer == 8){
    playerId = game.player8;
  }
  client.sendMessage(playerId + ' it\'s your turn!', game.channelId);
}



