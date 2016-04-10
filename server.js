var SlackClient = require('@slack/client').RtmClient;
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
var RTM_CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS.RTM;
var RTM_EVENTS = require('@slack/client').RTM_EVENTS;
var pg = require('pg');
//var config = require('./config');
var orm = require("orm");


var token = process.env.SLACK_API || config.slack;
var dbURL = process.env.DATABASE_URL || config.db.url;
var client = new SlackClient(token);
var botId;
var Game;
var Score;

////////////////////////////////////////////////////
// Startup
////////////////////////////////////////////////////

orm.connect(dbURL, function (err, db) {
  if (err) throw err;

  Game = db.define("games", {
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
      currentTurn   : Number,
      currentPlayer : Number,
      currentRoll   : Number,
      currentRoll1  : Number,
      currentRoll2  : Number,
      currentRoll3  : Number,
      currentRoll4  : Number,
      currentRoll5  : Number

    }, {
        methods: {
          totalRoll: function () {
            return this.currentRoll1 + this.currentRoll2 + this.currentRoll3 + this.currentRoll4 +
              this.currentRoll5;
          }
        },
        validations: {
        }
    });
  Score = db.define("scores", {
      id        : { type: 'serial', key: true },
      channelId  : String,
      userId: String,
      ones   : Number,
      twos   : Number,
      threes   : Number,
      fours   : Number,
      fives   : Number,
      sixes   : Number,
      upperBonus   : Number,
      threeOK   : Number,
      fourOK   : Number,
      fullHouse : Number,
      smallStraight   : Number,
      largeStraight  : Number,
      chance  : Number,
      yahtzee  : Number,
      yahtzeeBonus  : Number,
      turnCount  : Number
    }, {
        methods: {
          total: function () {
            var total = this.ones > -1 ? this.ones : 0;
            total = this.twos > -1 ? total + this.twos : total;
            total = this.threes > -1 ? total + this.threes : total;
            total = this.fours > -1 ? total + this.fours : total;
            total = this.fives > -1 ? total + this.fives : total;
            total = this.sixes > -1 ? total + this.sixes : total;
            total = this.upperBonus > -1 ? total + this.upperBonus : total;
            total = this.threeOK > -1 ? total + this.threeOK : total;
            total = this.fourOK > -1 ? total + this.fourOK : total;
            total = this.fullHouse > -1 ? total + this.fullHouse : total;
            total = this.smallStraight > -1 ? total + this.smallStraight : total;
            total = this.largeStraight > -1 ? total + this.largeStraight : total;
            total = this.chance > -1 ? total + this.chance : total;
            total = this.yahtzee > -1 ? total + this.yahtzee : total;
            total = this.yahtzeeBonus > -1 ? total + this.yahtzeeBonus : total;
            return total;
          },
          upperTotal: function () {
            var total = this.ones > -1 ? this.ones : 0;
            total = this.twos > -1 ? total + this.twos : total;
            total = this.threes > -1 ? total + this.threes : total;
            total = this.fours > -1 ? total + this.fours : total;
            total = this.fives > -1 ? total + this.fives : total;
            total = this.sixes > -1 ? total + this.sixes : total;
            return total;
          }
        },
        validations: {
        }
    });

    Score.hasOne('game', Game, {reverse: 'scores'});



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
      var params = getParams(prefix + 'start', message.text);
      setupNewGame(message, params)
    }
    // Roll logic
    else if(message.text.indexOf(prefix + 'roll') > -1 || message.text.indexOf(prefix + 'keep') > -1){
      var params = getParams(prefix + 'roll', message.text);
      Game.find({ channelId: message.channel }, function (err, games) {
        if (err) throw err;

        if(games.length < 1){
          client.sendMessage('Error: no game or turn is not over. Use keep or score hand', message.channel);
          return;
        }

        var userId = '<@' + message.user + '>';
        var playerId = getCurrentPlayerId(games[0]);

        if(playerId === userId){
          // count unused dice spots
          if(message.text.indexOf(prefix + 'keep') > -1) {
            executeKeepTurn(message, games[0], params);
            executeRollTurn(message, games[0]);
          }
          else {
            executeRollTurn(message, games[0]);
          }
        }
      });
    }
    else if(message.text.indexOf(prefix + 'score') > -1){
      var params = getParams(prefix + 'score', message.text);
      Game.find({ channelId: message.channel }, function (err, games) {
        if (err) throw err;

        if(games.length < 1){
          client.sendMessage('Error: no game', message.channel);
          return;
        }

        var userId = '<@' + message.user + '>';
        var playerId = getCurrentPlayerId(games[0]);

        if(playerId === userId){
          executeScoreTurn(message, games[0], params);
        }
      });
    }
    else if(message.text.indexOf(prefix + 'leaderboard') > -1){
      // send command info
      var params = getParams(prefix + 'leaderboard', message.text);
      Game.find({ channelId: message.channel }, function (err, games) {
        if (err) throw err;

        if(games.length < 1){
          client.sendMessage('Error: no game', message.channel);
          return;
        }

        displayLeaderboard(message, games[0], params);
      });
    }
    else if(message.text.indexOf(prefix + 'reset') > -1){
      Game.find({ channelId: message.channel }, function (err, games) {
        if (err) throw err;

        if(games.length < 1){
          client.sendMessage('Error: no game', message.channel);
          return;
        }else{
          Game.find({ channelId: games[0].channelId }).remove();
          Score.find({ channelId: games[0].channelId }).remove();
          client.sendMessage('Resetting', message.channel);
        }
      });
    }
    // Display help
    else if(message.text.indexOf(prefix + 'help') > -1){
      // send command info
      client.sendMessage('this is a test message', message.channel);
    }
  }
});

////////////////////////////////////////////////////
// Main Functions
////////////////////////////////////////////////////

function executeRollTurn(message, game){
  if(game.currentRoll === 4){
    client.sendMessage('Turn over. Score hand: *' + game.currentRoll1 + ' '
      + game.currentRoll2 + ' '
      + game.currentRoll3 + ' '
      + game.currentRoll4 + ' '
      + game.currentRoll5
      + '*', message.channel);
    return;
  }

  var count = game.currentRoll1 === 0 ? 1 : 0;
  count = game.currentRoll2 === 0? count + 1 : count; 
  count = game.currentRoll3 === 0? count + 1 : count; 
  count = game.currentRoll4 === 0? count + 1 : count; 
  count = game.currentRoll5 === 0? count + 1 : count; 

  game.currentRoll = game.currentRoll + 1;

  var dice = rollDice(count);

  for (var i =0; i<count; i++){
    if(5-count+i === 4){
      game.currentRoll5 = dice[i];
    }else if(5-count+i === 3){
      game.currentRoll4 = dice[i];
    }else if(5-count+i === 2){
      game.currentRoll3 = dice[i];
    }else if(5-count+i === 1){
      game.currentRoll2 = dice[i];
    }else if(5-count+i === 0){
      game.currentRoll1 = dice[i];
    }
  }
  client.sendMessage('Current hand: *' + game.currentRoll1 + ' '
    + game.currentRoll2 + ' '
    + game.currentRoll3 + ' '
    + game.currentRoll4 + ' '
    + game.currentRoll5
    + '*', message.channel);
  game.save();
}

function executeKeepTurn(message, game, params){
  if(game.currentRoll === 4){
    client.sendMessage('Turn over. Score hand: *' + game.currentRoll1 + ' '
      + game.currentRoll2 + ' '
      + game.currentRoll3 + ' '
      + game.currentRoll4 + ' '
      + game.currentRoll5
      + '*', message.channel);
    return;
  }
  // count unused dice spots
  var nums = params.split(' ').join('').split('').map(function(item) {
    return parseInt(item, 10);
  });

  // array of current rolls
  var rolls = [game.currentRoll1,game.currentRoll2,
    game.currentRoll3,game.currentRoll4,game.currentRoll5];  
  var keep = [];

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

  game.currentRoll1 = 0;
  game.currentRoll2 = 0;
  game.currentRoll3 = 0;
  game.currentRoll4 = 0;
  game.currentRoll5 = 0;
  for (var i =0; i<keep.length; i++){
    if(i === 4){
      game.currentRoll5 = keep[i];
    }else if(i === 3){
      game.currentRoll4 = keep[i];
    }else if(i === 2){
      game.currentRoll3 = keep[i];
    }else if(i === 1){
      game.currentRoll2 = keep[i];
    }else if(i === 0){
      game.currentRoll1 = keep[i];
    }
  }
  game.save();
  client.sendMessage('Keeping: *' + keep.join(' ') + '*. Rolling again...', message.channel);
}

function executeScoreTurn(message, game, params){
  var playerId = getCurrentPlayerId(game);

  Score.find({ channelId: game.channelId, userId: playerId }, function (err, scores) {
    if (err) throw err;

    if(scores.length === 0){
      Score.create(
        {
          channelId  : game.channelId,
          userId: playerId,
          ones   : -1,
          twos   : -1,
          threes : -1,
          fours   : -1,
          fives   : -1,
          sixes   : -1,
          upperBonus   : -1,
          threeOK : -1,
          fourOK  : -1,
          fullHouse : -1,
          smallStraight : -1,
          largeStraight  : -1,
          chance  : -1,
          yahtzee  : -1,
          yahtzeeBonus  : -1,
          turnCount  : 0,
          game_id: game.id
        }, 
        function(err) {
          if (err) throw err;

          Score.find({ channelId: game.channelId, userId: playerId }, function (err, scores) {
            if (err) throw err;

            if (scores.length > 0){
              applyScore(message, game, scores[0], params);
            }
          });
        }
      );
    }else{
      applyScore(message, game, scores[0], params);
    }
  });
}

function applyScore(message, game, score, params){
  var alreadyScored = false,
    rolls = [game.currentRoll1,game.currentRoll2,
      game.currentRoll3,game.currentRoll4,game.currentRoll5],
    total = 0;

  if(params === 'ones' || params === '1s'){
    total = game.currentRoll1 === 1 ? total + 1 : total;
    total = game.currentRoll2 === 1 ? total + 1 : total;
    total = game.currentRoll3 === 1 ? total + 1 : total;
    total = game.currentRoll4 === 1 ? total + 1 : total;
    total = game.currentRoll5 === 1 ? total + 1 : total;
    
    if(score.ones !== -1){
      alreadyScored = true;
    } else{
      score.ones = total;
    }
  }
  else if(params === 'twos' || params === '2s'){
    total = game.currentRoll1 === 2 ? total + 2 : total;
    total = game.currentRoll2 === 2 ? total + 2 : total;
    total = game.currentRoll3 === 2 ? total + 2 : total;
    total = game.currentRoll4 === 2 ? total + 2 : total;
    total = game.currentRoll5 === 2 ? total + 2 : total;
    
    if(score.twos !== -1){
      alreadyScored = true;
    } else{
      score.twos = total;
    }
  }
  else if(params === 'threes' || params === '3s'){
    total = game.currentRoll1 === 3 ? total + 3 : total;
    total = game.currentRoll2 === 3 ? total + 3 : total;
    total = game.currentRoll3 === 3 ? total + 3 : total;
    total = game.currentRoll4 === 3 ? total + 3 : total;
    total = game.currentRoll5 === 3 ? total + 3 : total;
    
    if(score.threes !== -1){
      alreadyScored = true;
    } else{
      score.threes = total;
    }
  }
  else if(params === 'fours' || params === '4s'){
    total = game.currentRoll1 === 4 ? total + 4 : total;
    total = game.currentRoll2 === 4 ? total + 4 : total;
    total = game.currentRoll3 === 4 ? total + 4 : total;
    total = game.currentRoll4 === 4 ? total + 4 : total;
    total = game.currentRoll5 === 4 ? total + 4 : total;
    
    if(score.fours !== -1){
      alreadyScored = true;
    } else{
      score.fours = total;
    }
  }
  else if(params === 'fives' || params === '5s'){
    total = game.currentRoll1 === 5 ? total + 5 : total;
    total = game.currentRoll2 === 5 ? total + 5 : total;
    total = game.currentRoll3 === 5 ? total + 5 : total;
    total = game.currentRoll4 === 5 ? total + 5 : total;
    total = game.currentRoll5 === 5 ? total + 5 : total;
    
    if(score.fives !== -1){
      alreadyScored = true;
    } else{
      score.fives = total;
    }
  }
  else if(params === 'sixes' || params === '6s'){
    total = game.currentRoll1 === 6 ? total + 6 : total;
    total = game.currentRoll2 === 6 ? total + 6 : total;
    total = game.currentRoll3 === 6 ? total + 6 : total;
    total = game.currentRoll4 === 6 ? total + 6 : total;
    total = game.currentRoll5 === 6 ? total + 6 : total;
    
    if(score.sixes !== -1){
      alreadyScored = true;
    } else{
      score.sixes = total;
    }
  }
  else if(params === 'threeOK' || params === '3ok'){
    var found = false;
    if(getAllIndexes(rolls, game.currentRoll1).length >= 3){
      found = true;
    }
    else if(getAllIndexes(rolls, game.currentRoll2).length >= 3){
      found = true;
    }
    else if(getAllIndexes(rolls, game.currentRoll3).length >= 3){
      found = true;
    }
    
    if(score.threeOK !== -1){
      alreadyScored = true;
    } else{
      if(found){
        total = game.totalRoll();
      }
      score.threeOK = total;
    }
  }
  else if(params === 'fourOK' || params === '4ok'){
    var found = false;
    if(getAllIndexes(rolls, game.currentRoll1).length >= 4){
      found = true;
    }
    else if(getAllIndexes(rolls, game.currentRoll2).length >= 4){
      found = true;
    }
    
    if(score.fourOK !== -1){
      alreadyScored = true;
    } else{
      if(found){
        total = game.totalRoll();
      }
      score.fourOK = total;
    }
  }
  else if(params === 'fullHouse' || params === 'DT' || params === 'dt'){
    var foundDouble = false,
      foundTriple = false;
    if(getAllIndexes(rolls, game.currentRoll1).length === 3){
      foundTriple = true;
    }
    else if(getAllIndexes(rolls, game.currentRoll1).length === 2){
      foundDouble = true;
    }

    if(getAllIndexes(rolls, game.currentRoll2).length === 3){
      foundTriple = true;
    }
    else if(getAllIndexes(rolls, game.currentRoll2).length === 2){
      foundDouble = true;
    }

    if(getAllIndexes(rolls, game.currentRoll3).length === 3){
      foundTriple = true;
    }
    else if(getAllIndexes(rolls, game.currentRoll3).length === 2){
      foundDouble = true;
    }

    if(getAllIndexes(rolls, game.currentRoll4).length === 3){
      foundTriple = true;
    }
    else if(getAllIndexes(rolls, game.currentRoll4).length === 2){
      foundDouble = true;
    }
    
    if(score.fullHouse !== -1){
      alreadyScored = true;
    } else{
      if(foundDouble && foundTriple){
        total = 25;
      }
      score.fullHouse = total;
    }
  }
  else if(params === 'smallStraight' || params === 'SS' || params === 'ss'){
    var found = false;

    if(rolls.indexOf(1) > -1 && rolls.indexOf(2) > -1 && rolls.indexOf(3) > -1
      && rolls.indexOf(4) > -1){
      found = true;
    }
    else if(rolls.indexOf(2) > -1 && rolls.indexOf(3) > -1 && rolls.indexOf(4) > -1
      && rolls.indexOf(5) > -1){
      found = true;
    }
    else if(rolls.indexOf(3) > -1 && rolls.indexOf(4) > -1 && rolls.indexOf(5) > -1
      && rolls.indexOf(6) > -1){
      found = true;
    }

    if(score.smallStraight !== -1){
      alreadyScored = true;
    } else{
      if(found){
        total = 30;
      }
      score.smallStraight = total;
    }
  }
  else if(params === 'largeStraight' || params === 'LS' || params === 'ls'){
    var rolls = [game.currentRoll1,game.currentRoll2,
      game.currentRoll3,game.currentRoll4,game.currentRoll5],
      found = false;

    if(rolls.indexOf(1) > -1 && rolls.indexOf(2) > -1 && rolls.indexOf(3) > -1
      && rolls.indexOf(4) > -1 && rolls.indexOf(5) > -1){
      found = true;
    }
    else if(rolls.indexOf(2) > -1 && rolls.indexOf(3) > -1 && rolls.indexOf(4) > -1
      && rolls.indexOf(5) > -1 && rolls.indexOf(6) > -1){
      found = true;
    }
    

    if(score.largeStraight !== -1){
      alreadyScored = true;
    } else{
      if(found){
        total = 40;
      }
      score.largeStraight = total;
    }
  }
  else if(params === 'chance' || params === '??'){
    if(score.chance !== -1){
      alreadyScored = true;
    } else{
      total = game.totalRoll();
      score.chance = total;
    }
  }
  else if(params === 'yahtzee' || params === 'Yahzee'){
    var found = false;
    if(getAllIndexes(rolls, game.currentRoll1).length > 4){
      found = true;
    }

    if(score.yahtzee !== -1){
      alreadyScored = true;
    } else{
      if(found){
        total = 50;
      }
      score.yahtzee = total;
    }
  }
  else{
    client.sendMessage('Bad score command - try again (1s, 2s, 3s, 4s, 5s, 6s, 3ok, 4ok, dt, ss, ls, yahtzee)', message.channel);
    return;
  }
  // yahtzeeBonus

  // score upper Bonus
  if(score.upperBonus === 0) {
    score.upperBonus = score.upperTotal() >= 63 ? 35 : 0;
    if(score.upperBonus > 0){
      client.sendMessage('*Upper Bonus Scored!*', message.channel);
    }
  }

  // score Yahtzee Bonus
  if(getAllIndexes(rolls, game.currentRoll1).length > 4 &&params !== 'yahtzee' && params !== 'Yahzee') {
    score.yahtzeeBonus = score.yahtzeeBonus > 0 ? score.yahtzeeBonus + 100 : 100;
    client.sendMessage('*Upper Bonus Scored!*', message.channel);
  }


  if(alreadyScored === true)
    client.sendMessage('Already scored in that column!', message.channel);
  else{
    score.turnCount = score.turnCount + 1;
    score.save();
    client.sendMessage('Scoring ' + params + ', score: ' + total, message.channel);
    notifyNextPlayer(message, game);
  }
}

function setupNewGame(message, params){
  //find if there's already a game
  Game.find({ channelId: message.channel }, function (err, games) {
    if (err) throw err;

    if(games.length === 0 || games[0].currentTurn === 14){ // or end game turn is 14
      if(games.length > 0){
        // Delete old games..
        Game.find({ channelId: message.channel }).remove();
        Score.find({ channelId: message.channel }).remove();
      }

      var players = params.split(" ");

      if(players.length > 0 && players.length < 9){
        Game.create(
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

            Game.find({ channelId: message.channel, currentTurn: 0 }, function (err, games) {
              if (err) throw err;

              if (games.length > 0){
                notifyNextPlayer(message, games[0]);
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

function displayLeaderboard(message, game)
{
  // do single score based on params
  var text = 'Current Scoreboard:\n';
  text = text + 'player |  1  |  2  |  3  |  4  |  5  |  6  |  UB  |  3ok  |  4ok  |  dt  |  ss  |  ls  |  ??  |  y!  |  turn  | total\n';
  Score.find({ channelId: game.channelId }, function (err, scores) {
    if (err) throw err;

    if(scores.length > 0){
      for(score in scores){
        var line = scores[score].userId + ' |' + displayScore(scores[score].ones) + '|' + displayScore(scores[score].twos) + '|' + displayScore(scores[score].threes)
          + '|' + displayScore(scores[score].fours) + '|' + displayScore(scores[score].fives) + '|' + displayScore(scores[score].sixes) + '|' + displayScore(scores[score].upperBonus) + 
          ' |' + displayScore(scores[score].threeOK) + '|' + displayScore(scores[score].fourOK) + '|' + displayScore(scores[score].fullHouse) + '|' + displayScore(scores[score].smallStraight) +
           '|' + displayScore(scores[score].largeStraight) + '|' + displayScore(scores[score].chance) + '|' + displayScore(scores[score].yahtzee) + '|' + displayScore(scores[score].turnCount) + '|' + scores[score].total() + '\n';
        text = text + line;
      }
      client.sendMessage(text, message.channel);
    }
  });
}

////////////////////////////////////////////////////
// Helper Functions
////////////////////////////////////////////////////

function displayScore(score){
  if(score === -1)
    return ' - ';

  score = score + '';
  if(score.length === 1)
    return ' ' + score + ' ';
  if(score.length === 2)
    return ' ' + score;
  return score;
}

function getParams(command, text){
  var commandLength = command.length;
  return text.substr(commandLength, text.length-commandLength).trim();
}

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

function notifyNextPlayer(message, game){
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

  if(game.currentTurn === 13){
    displayLeaderboard(message, game);
    client.sendMessage('GAME OVER', game.channelId);
    Game.find({ channelId: game.channelId }).remove();
    Score.find({ channelId: game.channelId }).remove();
  }else {
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
}

function getCurrentPlayerId(game){
  if(game.currentPlayer == 1){
    return game.player1;
  }else if (game.currentPlayer == 2){
    return game.player2;
  }else if (game.currentPlayer == 3){
    return game.player3;
  }else if (game.currentPlayer == 4){
    return game.player4;
  }else if (game.currentPlayer == 5){
    return game.player5;
  }else if (game.currentPlayer == 6){
    return game.player6;
  }else if (game.currentPlayer == 7){
    return game.player7;
  }else if (game.currentPlayer == 8){
    return game.player8;
  }
}

function getAllIndexes(arr, val) {
  var indexes = [], i = -1;
  while ((i = arr.indexOf(val, i+1)) != -1){
      indexes.push(i);
  }
  return indexes;
}



