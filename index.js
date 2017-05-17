// 'use strict';
var Alexa = require('alexa-sdk');
var https = require('https');
var AWS = require("aws-sdk");
var queryString = require('querystring');

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    // AWS.config.update({endpoint: "https://dynamodb.us-east-1.amazonaws.com"});
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
     'LaunchRequest': function () {
            this.emit(':ask', "What would you like to know?");
        },
     'AMAZON.HelpIntent': function () {
                var speechOutput = this.t("HELP_MESSAGE");
                var reprompt = this.t("HELP_MESSAGE");
                this.emit(':ask', speechOutput, reprompt);
            },
     'AMAZON.CancelIntent': function () {
                this.emit(':tell', this.t("STOP_MESSAGE"));
     },
    'SurpriseMe': function() {
        var self = this;
        var docClient = new AWS.DynamoDB.DocumentClient();
        console.log("Querying for refresh token");

        var params = {
            TableName: "UserAccess",
            ProjectionExpression: "refreshToken"
        };
        console.log("Scanning UserAccess table.");
        docClient.scan(params, onScan);
        function onScan (err, data) {
            if (err) {
                console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
            } else {
                console.log("Scan succeeded.");
                console.log(data.Items[0].refreshToken);
                var currentRefreshToken = data.Items[0].refreshToken; 
                getNewAccessToken(currentRefreshToken, self, docClient);
            }
        }
    },
    'ReturnOptions': function() {
        var speechOutput = 'Let me check... Surprise me Travel has Phoenix, Arizona for 95,000 points.';
        this.emit(':ask', speechOutput);
    },
    'GiveMoreOptions': function() {
        var speechOutput = 'How about Joshua Tree Park, in sunny California, for 220,000 points? I see you don’t have enough points, but it looks like you still need 119,070 points. with Chip in you will have enough points.';
        this.emit(':ask', speechOutput);
    },
    'SelectOption': function(){
        this.emit(':ask', 'Selected Joshua Tree Park as vacation destination. By choosing this destination, you will triple your rewards points that you could be used towards your next vacation. Would you like to invite your friends on this vacation?');
    },
    'InviteFriends': function(){
        this.emit(':tell', ' Looking up John and Mary contact information. I see John is already your friend using the SurpriseMe app. I’ll send him the invite right away. I don’t see Mary in your SurpriseMe contacts. Let’s surprise her with an invite to SurpriseMe. If Mary signs up for the Capital One Smart Rewards Credit card, she will get 20,000 points towards her travel, and you will get 20,000 points as a referral.');
    },
    'GetRewardPoints': function() {
       this.emit(':tell', 'You have 25000 points');
    },
    'AMAZON.StopIntent': function () {
             this.emit(':tell', this.t("STOP_MESSAGE"));
    }
};

function getNewAccessToken(currentRefreshToken, self, docClient){
     // form data
     var postData = queryString.stringify({
        client_id:'enterpriseapi-sb-yKWujZdtfayUeCwmBe2lKBna',
        client_secret:'138d11d25f199f2e0e233cc1e80975d339cbb96c',
        grant_type:'refresh_token',
        refresh_token: currentRefreshToken
     });

     var refresh_token_post_options = {
         host : 'api-sandbox.capitalone.com',
         path : '/oauth/oauth20/token',
         method: 'POST',
         headers: {
             accept: '*/*',
             'Content-Type':'application/x-www-form-urlencoded',
             'Content-Length': postData.length
            }
     }

     var post_req = https.request(refresh_token_post_options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function (d) {
                var postInfo = JSON.parse(d);
                getRewardPoints(postInfo.access_token, self);
                updateRefreshToken(postInfo.refresh_token, docClient);
            });
        });
        // post the data
        post_req.write(postData);
        post_req.end();
        post_req.on('error', function(e) {
                    console.error(e);
        });
}

function getRewardPoints(accessToken, self) {
        console.log('the accesToken recieved by rewards points fetch function is '+ accessToken);
        var options = {
         host: 'api-sandbox.capitalone.com',
         path: '/rewards/accounts/%2BjaR3Du6APE%2Bx4kQue7NB1Z6IEL1OWtPNoA4jkumi8xA%2FRv0eY0VcPYd2Kzm5jNPNcfriz1XC0LlPgonb7VWsw%3D%3D',
         method: 'GET',
         headers: {
            accept: '*/*',
            Authorization : 'Bearer '+accessToken
         }
        };

          var req = https.request(options, function(res) {
          res.on('data', function(d) {
            var recv = JSON.parse(d);
            console.log(recv);
            var speechOutput = recv.rewardsBalance;
            console.log('the rewards points value is'+speechOutput);
            self.emit(':ask', 'you have '+speechOutput+ ' Smart Rewards points available. Can I surprise you with a vacation?');
          });
        });
        req.end();

        req.on('error', function(e) {
            console.error(e);
        });
}

function updateRefreshToken(newRefreshToken, docClient) {
console.log('the newRefreshToken recieved by update refresh token function is '+ newRefreshToken);
  var params = {
      TableName: "UserAccess",
      Key:{
              "id": "1"
          },
          UpdateExpression: "set refreshToken = :r",
          ExpressionAttributeValues:{
              ":r": newRefreshToken
          },
          ReturnValues:"UPDATED_NEW"
  };
  console.log("Updating the item...");
  docClient.update(params, function(err, data) {
      if (err) {
          console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
      } else {
          console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
          console.log('the latest refresh token is'+data.Attributes.refreshToken);
      }
  });
}