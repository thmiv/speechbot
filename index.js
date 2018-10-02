'use strict';

require('dotenv').config()
const APIAI_TOKEN = process.env.APIAI_TOKEN;
const APIAI_SESSION_ID = process.env.APIAI_SESSION_ID;
const mongoose = require("mongoose");
const express = require('express');
const app = express();
const http = require('http').Server(app);
// Require all models
const db = require("./models");

// If deployed, use the deployed database. Otherwise use the local mongoHeadlines database
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/SpotBot";
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI, { useNewUrlParser: true });

app.use(express.static(__dirname + '/views')); // html
app.use(express.static(__dirname + '/public')); // js, css, images

const server = app.listen(process.env.PORT || 5000, () => {
  console.log('Express server listening on port %d in %s mode', server.address().port, app.settings.env);
});

const io = require('socket.io')(server);
io.on('connection', function(socket){
  console.log('a user connected');
});

const apiai = require('apiai')(APIAI_TOKEN);

// Web UI
app.get('/', (req, res) => {
  res.sendFile('index.html');
});

io.on('connection', function(socket) {
  socket.on('chat message', (text) => {
    console.log('Message: ' + text);

    // Get a reply from API.ai

    let apiaiReq = apiai.textRequest(text, {
      sessionId: APIAI_SESSION_ID
    });

    apiaiReq.on('response', (response) => {
      let aiText = response.result.fulfillment.speech;
      console.log('Bot reply: ' + aiText);
      socket.emit('bot reply', aiText);
    });

    apiaiReq.on('error', (error) => {
      console.log(error);
    });

    apiaiReq.end();

  });
});

// Routes *************************************************************************
// Route for retrieving all Posts from the db
app.get("/db/history", function(req, res) {
  // Find all Posts
  db.History.find({})
    .then(function(dbPost) {
      // If all Posts are successfully found, send them back to the client
      res.json(dbPost);
    })
    .catch(function(err) {
      // If an error occurs, send the error back to the client
      res.json(err);
    });
});

// Route for retrieving all Users from the db
app.get("/db/user", function(req, res) {
  // Find all Users
  db.User.find({})
    .then(function(dbUser) {
      // If all Users are successfully found, send them back to the client
      res.json(dbUser);
    })
    .catch(function(err) {
      // If an error occurs, send the error back to the client
      res.json(err);
    });
});

// Route for saving a new Post to the db and associating it with a User
app.post("/db/submit", function(req, res) {
  // Create a new Post in the db
  db.History.create(req.body)
    .then(function(dbPost) {
      // If a Post was created successfully, find one User (there's only one) and push the new Post's _id to the User's `posts` array
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.User.findOneAndUpdate({}, { $push: { attributes: dbPost._id } }, { new: true });
    })
    .then(function(dbUser) {
      // If the User was updated successfully, send it back to the client
      res.json(dbUser);
    })
    .catch(function(err) {
      // If an error occurs, send it back to the client
      res.json(err);
    });
});

// Route to get all User's and populate them with their notes
app.get("/db/populateduser", function(req, res) {
  // Find all users
  db.User.find({})
    // Specify that we want to populate the retrieved users with any associated notes
    .populate("posts")
    .then(function(dbUser) {
      // If able to successfully find and associate all Users and Notes, send them back to the client
      res.json(dbUser);
    })
    .catch(function(err) {
      // If an error occurs, send it back to the client
      res.json(err);
    });
});