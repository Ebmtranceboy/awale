const hidden = require('./hidden');
const telegramBot = require('node-telegram-bot-api');
const token = hidden.TOKEN;
const api = new telegramBot(token, {polling: true});

const initialBoard = Array.from(new Array(12), (_,__) => 4);
const humanIndices =  Array.from(new Array(6), (_,i) => i+6);
const botIndices =  Array.from(new Array(6), (_,i) => i);

let initialGame = {started: false, board: initialBoard, humanScore: 0, botScore: 0};

let chatId;
let fromName;
let game;

const distribute = (index) => {
	const val = game.board[index];
	game.board[index] = 0;
	let i = index;
	for(let v = 0; v < val; v++){
		i = i > 0 ? i - 1 : 11;
		game.board[i] ++;
	}
	return i;
};

const sb = (index) => String(game.board[index]);

const convert = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'B6', 'B5', 'B4', 'B3', 'B2', 'B1'];
const cell = (i) => {return {text: sb(i), callback_data: convert[i]};};

const displayBoard = () => {
	api.sendMessage(chatId, 'Your turn:', {reply_markup: JSON.stringify({
                      inline_keyboard: [
                          Array.from(new Array(6), (_,i) => cell(i))
			      , Array.from(new Array(6), (_,i) => cell(11-i))
                      ]
                  })}
	);
};

api.onText(/\/start/, function(msg, match){
	if(game && game.started) api.sendMessage(msg.chat.id, 'Game has already started. Type "/stop" to end it first.');
	else {
		game = {...initialGame};
		game.board = {...initialBoard};
		game.started = true;
		chatId = msg.chat.id;
		fromName = msg.from.username;
		api.sendMessage(chatId, 'Starting new game against me (AwaleeBot). Type "/score" to know who\'s winning. Type "/stop" if you want to end it.');
	}
	displayBoard();
});

api.onText(/\/score/, function(msg, match){
	api.sendMessage(msg.chat.id, `${fromName}: ${game.humanScore}    Bot: ${game.botScore}`);
});
	
api.onText(/\/stop/, function(msg, match){
	if(game.started) api.sendMessage(msg.chat.id, 'End this game ?', {reply_markup: JSON.stringify({inline_keyboard: [[{text: "Yes", callback_data: "STOP"}, {text: "No", callback_data: "CONTINUE"}]]})});
});

const enough = (index) => game.board[index] > 3;

const humanChoose = (index) => {
	if(!humanIndices.includes(index)){ 
		api.sendMessage(chatId, 'Those are MY pebbles, bloody human! Keep out !!');
		displayBoard();
	}
	else if(!enough(index)){ 
		api.sendMessage(chatId, 'Choose something else. There\'s not enough pebbles here!');
		displayBoard();
	}

	else {
		botProcess(distribute(index));
	}
};

const reap = (index, human) => {
	const indices = human? humanIndices:botIndices;
	let i = index;
	let pebbles = 0;
	while(indices.includes(i) && (game.board[i] == 2 || game.board[i] == 3)){
		if(human) game.botScore += game.board[i];
		else game.humanScore += game.board[i];
		pebbles += game.board[i];
		game.board[i] = 0;
		i++;
		if(i==12) i=0;
	}
	if(pebbles>0) api.sendMessage(chatId, `${human?'Bot':fromName} has collected ${pebbles} pebbles.`);
};

const humanProcess = () => {
	const humanCanPlay = humanIndices.some(x => enough(x));
	const botCanPlay = botIndices.some(x => enough(x));
	if(humanCanPlay){
		if(!botCanPlay) api.sendMessage(chatId, 'I\'m stuck.');
		displayBoard();
	} // else if(botCanPlay) 
	else{
		game.humanScore += humanIndices.map(i => game.board[i]).reduce((a,b)=>a+b);
		game.botScore += botIndices.map(i => game.board[i]).reduce((a,b)=>a+b);
		api.sendMessage(chatId, `Game over. Final scores
			${fromName}: ${game.humanScore}    Bot: ${game.botScore}
			${game.humanScore > game.botScore? fromName : (game.humanScore < game.botScore ? 'Bot' : No-one)} wins !!`);
		game.started = false;
	}
};

const botProcess = (index) => {
	reap(index, false);

	let choices = botIndices.filter(i => enough(i));
	let humanCanPlay;
	let choice;
	if(choices.length > 0){
		do{
			choice = choices[Math.floor(Math.random() * choices.length)];
			api.sendMessage(chatId, `I play ${convert[choice]}.`);
			reap(distribute(choice),true);
			humanCanPlay = humanIndices.some(x => enough(x));
			choices = botIndices.filter(i => enough(i));
			if(!humanCanPlay) api.sendMessage(chatId, 'Seems you cannot play.');
		}
		while(!humanCanPlay && choices.length > 0);
		humanProcess();
	}
	else humanProcess();
};

api.on( "callback_query", function( cq ) {
	if(cq.data == 'STOP'){
		game.started = false;
		api.sendMessage(chatId, 'Ok. Game ended. Type "/start" to start a new one!');
	}
	else if(cq.data == 'CONTINUE'){
		api.sendMessage(chatId, 'Ok. Keep on playing ...');
		displayBoard();
	}
	else{
		const index = convert.indexOf(cq.data);
		humanChoose(index);
	}
	console.log(JSON.stringify(cq.data));

      	api.answerCallbackQuery( cq.id, {} );

  }

);
console.log("Bot loaded.");
