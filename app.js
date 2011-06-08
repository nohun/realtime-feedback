/**
 * Module dependencies.
 */

var express = require('express'),
	io = require('socket.io'),
	models = require('./lib/models'),
	Comments = models.Comments;

var app = module.exports = express.createServer();

var socket = io.listen(app);

var host=process.env.VCAP_APP_HOST || 'localhost';
var port=process.env.VCAP_APP_PORT || 3000;

// HashMap
var HashMap = function(){   
    this.map = new Array();
};   
HashMap.prototype = {   
    put : function(key, value){   
        this.map[key] = value;
    },   
    get : function(key){   
        return this.map[key];
    },   
    getAll : function(){   
        return this.map;
    },   
    clear : function(){   
        this.map = new Array();
    },   
    getKeys : function(){   
        var keys = new Array();   
        for(i in this.map){   
            keys.push(i);
        }   
        return keys;
    }
};

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'let me know who you are' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Socket IO

var channelMap = new HashMap();
socket.on('connection', function(client){
	var clientSessionId = client.sessionId;
	client.on('message', function(message){
		console.log(message);
		
		var channel = message.channel;
		var action = message.type;
		var msg = message.msg;
		if(action === 'subscribe'){
			var clientList = channelMap.get(channel);
			if(!clientList) {
				// console.log("empty");
				var clientList = new Array();
				clientList[clientSessionId] = client;
				channelMap.put(channel, clientList);
			} else {
				clientList[clientSessionId] = client;
			}
			console.log(clientList[clientSessionId] === client);
		} else if(action === 'publish') {
			// save
			var newComments = new Comments();
			newComments.to = channel;
			newComments.from = msg.from;
			newComments.body = msg.body;
			newComments.emotion = msg.emotion;
			newComments.date = new Date();
			newComments.save(function(err){
				//console.log(err);
			});
			
			// publish
			var clientList = channelMap.get(channel);
			for(var i in clientList) {
				clientList[i].send({'msg':msg});
			}
		}		
	});
	client.on('disconnection', function(){
		
	});
});


// Routes
app.get('/', function(req, res){
	res.render('index');
});

app.post('/login', function(req, res){
	var username = req.body.username;	
	console.log(username);
	// validate username
	// if it has error, return to the form with the error message.
	req.session.username = username;
	res.redirect('list');
});

app.get('/list', function(req, res){
	// get the presentation list
	res.render('list', {'username':req.session.username});
});

app.get('/comments', function(req, res){
	res.contentType('application/json');
	var commentList = Comments.find(req.query, function(err, docs){
		res.send(docs);
	});
});

app.get('/p/:id', function(req, res){
	var to = req.params.id;
	var disCount, diffCount, likeCount, sameCount, queCount, allCount;
	Comments.find({'to':to, 'emotion':'불만이 있습니다.'}).count(function(err, count){
		disCount = count;
		Comments.find({'to':to, 'emotion':'다르게 생각합니다.'}).count(function(err, count){
			diffCount = count;
			Comments.find({'to':to, 'emotion':'좋아합니다.'}).count(function(err, count){
				likeCount = count;
				Comments.find({'to':to, 'emotion':'공감하고 있습니다.'}).count(function(err, count){
					sameCount = count;
					Comments.find({'to':to, 'emotion':'궁금해 합니다.'}).count(function(err, count){
						queCount = count;
						Comments.find({'to':to}).count(function(err, count){
							allCount = count;
								res.render('presentation', {'port':port, 'username':req.session.username, 'p_id':req.params.id, 'title':req.query.title,'disCount':disCount, 'diffCount':diffCount, 'likeCount':likeCount, 'sameCount':sameCount, 'queCount':queCount, 'allCount':allCount});
						});
					});	
				});
			});
		});
	});
});

app.listen(port);
console.log("Express server listening on port %d", app.address().port);
