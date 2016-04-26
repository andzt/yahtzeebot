## YahtzeeBot

YahtzeeBot is a slack bot that will facilitate a game of Yahtzee from within your Slack channel. The games are channel specific, so you can even run multiple games per Slack channel.

## Setup Bot
Setup YahtzeeBot following the Slack integration instructions.


## Heroku Setup
Easy to setup on Heroku. Create a new instance with a PostgreSQL and push. Set the following environment variable:
process.env.SLACK_API = 'SLACK API TOKEN'


## Commands

YahtzeeBot works with Slack by waiting for commands. YahtzeeBot understands the following commands:

### Start a new game:
>@(botname): start @(player1) @(player2) @(player3)

Allows up to 8 players at a time

### Roll (if it's your turn)
>roll

No other command needed

### Keep dice and Re-roll
>keep ###

where # is the value of the dice rolled that you would like to keep

For example:
>keep 555

Will keep the three dice that rolled the value 5. YahtzeeBot will notify you of a bad keep or score command, so don't try to fool it.

### Score a hand
>score (column_name)

Valid column names: 1s, 2s, 3s, 4s, 5s, 6s, 3k, 4k, dt (full house), ss (small straight), ls (large straight), y! (yahtzee)

Note: To score a Yahtzee Bonus, score for columns 1-6, 3k, or 4k

### Leaderboard
>@(bot_name): leaderboard

### Reset
>@(bot_name): reset


