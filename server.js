//	Customization

var appPort = 3000;

// Librairies

var express = require('express'), app = express();
var http = require('http')
  , server = http.createServer(app)
  , io = require('socket.io').listen(server);

var assert = require('assert');

var jade = require('jade');
// var io = require('socket.io').listen(app);
var pseudoArray = ['admin']; //block the admin username (you can disable it)

var MongoClient = require('mongodb').MongoClient;
var urlMongo = 'mongodb://localhost:27017/test';

// Views Options

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set("view options", { layout: false });

app.use(express.static(__dirname + '/public'));

// Render and send the main page

app.get('/', function(req, res){
  res.render('index.jade');
});

app.get('/chat', function(req, res){
  res.render('home.jade');
});
server.listen(appPort);
// app.listen(appPort);
console.log("Server listening on port " + appPort);

// Handle the socket.io connections

var users = 0; //count the users

io.sockets.on('connection', function (socket) { // First connection
	users += 1; // Add 1 to the count
	reloadUsers(); // Send the count to all the users

	socket.on('message', function (data) { // Broadcast the message to all
		if(pseudoSet(socket))
		{
			var dateCurr = new Date().toISOString();
			var transmit = {date : dateCurr, pseudo : socket.nickname, message : data};
			socket.broadcast.emit('message', transmit);
			console.log("user "+  +" said \""+data+"\"");
			MongoClient.connect(urlMongo, function(err, db) {
            assert.equal(null, err);
            insertDocument(db,transmit['pseudo'],dateCurr,data,"Message",function() {
                db.close();
            });
          });
		}
	});
	socket.on('connected', function (data) {
		var json = {items:[]};

			MongoClient.connect(urlMongo, function(err, db) {
				assert.equal(null, err);
				var cursor =db.collection('Message').find().toArray(function(e, d) {
					db.close();
					
					for(var i=0;i<d.length;i++)
					{
						json.items.push({
							"username":d[i].username,
							"date":d[i].date,
							"message":d[i].message,
						});
					}
					console.log(json);
					socket.emit("historyData",json);

				});
			});
			
			
	});
	socket.on('setPseudo', function (data) { // Assign a name to the user
		if (pseudoArray.indexOf(data) == -1) // Test if the name is already taken
		{
			pseudoArray.push(data);
			socket.nickname = data;
			socket.emit('pseudoStatus', 'ok');
			

			console.log("user " + data + " connected");
		}
		else
		{
			socket.emit('pseudoStatus', 'error') // Send the error
		}
	});
	socket.on('disconnect', function () { // Disconnection of the client
		users -= 1;
		reloadUsers();
		if (pseudoSet(socket))
		{
			console.log("disconnect...");
			var pseudo;
			pseudo = socket.nickname;
			var index = pseudoArray.indexOf(pseudo);
			pseudo.slice(index - 1, 1);
		}
	});
});

function reloadUsers() { // Send the count of the users to all
	io.sockets.emit('nbUsers', {"nb": users});
}
function pseudoSet(socket) { // Test if the user has a name
	var test;
	if (socket.nickname == null ) test = false;
	else test = true;
	return test;
}


var insertDocument = function(db,username,date,message,dbname,callback) {
   db.collection(dbname).insertOne( {
      "username" : username,
      "date" : date,
      "message"     : message
   }, function(err, result) {
    assert.equal(err, null);
    console.log("Inserted a document into the Message collection.");
    callback();
  });
};