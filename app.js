var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	mongoose = require('mongoose'),
	users = {};
	// nicknames =[];
server.listen(80);

// Prueft, ob eine Verbindung zu einer mongodb Datenbank besteht
mongoose.connect('mongodb://localhost/chat', function(err){
	if(err){
		console.log(err);
	} else{
		console.log('Connected to mongodb!');
	}
});

// Das Format, in welchem die Daten in der Mongo DB gespreichert werden
var chatSchema = mongoose.Schema({
	nick: String,
	msg: String,
	created: {type: Date, default: Date.now}
});

// Neue Instanz von Mongoose Model
var Chat = mongoose.model('Message', chatSchema);

// Stellt den Bezug zu den Daten aus der index.html her
app.get('/', function(req, res){
	res.sendfile(__dirname + '/index.html');
});

// 

io.sockets.on('connection', function(socket){
	var query = Chat.find({});
	
	// Gibt die letzten 8 Nachrichten sortiert aus
	query.sort('-created').limit(8).exec(function(err, docs){
		if(err) throw err;
		socket.emit('load old msgs', docs);
	});
	
	// Legt neuen User an. Falls nicht vorhanden, wird ein User einem Socket zugewiesen 
	socket.on('new user', function(data, callback){
		if (data in users){
			callback(false);
		} else{
			callback(true);
			socket.nickname = data;
			users[socket.nickname] = socket;
			updateNicknames();
		}
	});
	
	
	// aktualisiert die Anwesenden User in der Namensliste
	function updateNicknames(){
		io.sockets.emit('usernames', Object.keys(users));
	}

	// Funktion zum Versenden von Nachrichten
	socket.on('send message', function(data, callback){
		
		// Whitespaces eliminieren 
		var msg = data.trim();
		console.log('after trimming message is: ' + msg);
		
		// Whisperfunktion. Es wird ueberprueft, ob die ersten Eingabezeichen, der Folge '/w ' entsprechen
		if(msg.substr(0,3) === '/w '){
			msg = msg.substr(3);
			// Space zwischen Namen und Message
			var ind = msg.indexOf(' ');
			if(ind !== -1){
				var name = msg.substring(0, ind);
				var msg = msg.substring(ind + 1);
				
				// Wenn Namen unter Usern vorhanden, dann wird eine Nachricht versendet
				if(name in users){
					users[name].emit('whisper', {msg: msg, nick: socket.nickname});
					console.log('message sent is: ' + msg);
					console.log('Whisper!');
				
				// Wenn Username falsch eingegeben oder nicht vorhanden/nichts eingegeben 
				} else{
					callback('Error!  Enter a valid user.');
				}
				// Wenn keine Message vorhanden
			} else{
				callback('Error!  Please enter a message for your whisper.');
			}
			
			// Messageausgabe an alle, inklusive einen selbst. 
			
		} else{
			var newMsg = new Chat({msg: msg, nick: socket.nickname});
			
			// Die Nachricht wird in die Dabenbank geschrieben
			newMsg.save(function(err){
				if(err) throw err;
				// Die Nachricht wird in den Chat geschrieben
				io.sockets.emit('new message', {msg: msg, nick: socket.nickname});
			});
		}
	});
	
	// Funktion zum Handling von Usern, die den Chat beenden
	socket.on('disconnect', function(data){
		// Wenn kein Name gesetzt gehe aus der Funktion raus
		if(!socket.nickname) return;
		// Entfernt Socket mitsamt zugehoerigem User
		delete users[socket.nickname];
		// Updaten die Namen in der Chatliste
		updateNicknames();
	});
});