var five = require("johnny-five");
var keypress = require("keypress");
var pixel = require("../tetris/node-pixel/lib/pixel.js");

var opts = {};
opts.port = process.argv[2] || "";

var j5board = new five.Board(opts);
var strip = null;

var UP = 38;
var DOWN = 40;
var LEFT = 37;  
var RIGHT = 39;    

var speed = 750;
var timeOutToRenderLEDs = 60;
var cols = 8, rows = 16;

var joystick, button;
/*
//uncomment for browser support
var width = 200, height = 400;
var canvas = document.createElement('canvas');
var blockWidth = width / cols, blockHeight = height / rows;
*/

var shapes = [
    { blocks: [0xCC00, 0xCC00, 0xCC00, 0xCC00], color: 'yellow'},
    { blocks: [0x0F00, 0x2222, 0x00F0, 0x4444], color: 'cyan'},
    { blocks: [0x4E00, 0x4640, 0x0E40, 0x4C40], color: 'magenta'},
    { blocks: [0x8E00, 0x6440, 0x0E20, 0x44C0], color: 'navy'},
    { blocks: [0x2E00, 0x4460, 0x0E80, 0xC440], color: 'maroon'},
    { blocks: [0x06C0, 0x8C40, 0x6C00, 0x4620], color: 'green'},
    { blocks: [0x0C60, 0x4C80, 0xC600, 0x2640], color: 'red'} 
];

/*
//uncomment for browser support
canvas.width = width;
canvas.height = height;
var context = canvas.getContext('2d');
*/

var rowsCompleted = 0;
var board, intervalId, currentPlayingPiece;

function drawBlock(x, y, color) {
  /*
  //uncomment for browser support
  context.fillStyle = color;
  context.fillRect(blockWidth*x, blockHeight*y, blockWidth-1, blockHeight-1);
  context.strokeRect(blockWidth*x, blockHeight*y, blockWidth-1, blockHeight-1);
  */
  strip.pixel(toMatrixPos(x,y)).color(color);
}

function clearBlock(x, y) {
  /*
  //uncomment for browser support
  context.fillStyle = 'white';
  context.clearRect(blockWidth*x-1, blockHeight*y-1, blockWidth+2, blockHeight+2);
  */
  strip.pixel(toMatrixPos(x,y)).color('#000');
}

function PlayingPiece(x,y,shape) {
  this.x = x;
  this.y = y; 
  this.direction = 0;
  this.color = shape.color;  
  this.shapeBlocks = shape.blocks;
}

PlayingPiece.prototype.forEachBlock = function(func) {  
  var r = 0, c = 0;    
  var blocks = this.shapeBlocks[this.direction];

  for (var shift = 15; shift >= 0; shift--) {
    if ((blocks >> shift) & 1) {        
      func(this.x + c, this.y + r);
    }

    c++;

    if (c == 4) {
      c = 0;
      r++;
    }
  }
}

PlayingPiece.prototype.render = function(clear) {  
  clear = clear || 0;
  if (clear) {
    this.forEachBlock(function(x,y){
        clearBlock(x,y);
    });
  } else {
    var color = this.color;
    
    this.forEachBlock(function(x,y){
        drawBlock(x,y,color);
    });
  }
  strip.show();
};

PlayingPiece.prototype.renderClear = function(){
  this.render(1);
}

PlayingPiece.prototype.fit = function(direction) {
  var fit = true;
  this.forEachBlock(function(x,y) {
    var l = x > 0;
    var d = y < board.rows-1;
    var r = x < board.columns-1;  
    var b = board.isBlockEmpty(x, y+1);

    fit = fit && b && (
                       ((direction == LEFT)  && l)             ||
                       ((direction == RIGHT) && r)             || 
                       ((direction == UP)    && (l || r) && d) ||
                       ((direction == DOWN)  && (l || r) && d)
                      );
  });

  return fit;
};

PlayingPiece.prototype.update = function() {  
  if (this.fit(DOWN)) {
    this.renderClear();
    this.y++;  
    playingPiece = this;
    setTimeout(function(){playingPiece.render()},timeOutToRenderLEDs);
    //this.render();
  } else {
    var color = this.color;
    this.forEachBlock(function(x,y) {
        board.setBlock(x,y,color);
    });

    var rowsToClear = board.checkRows();    
    if (rowsToClear.length > 0) {
      rowsCompleted += rowsToClear.length;
      if ((rowsCompleted % 3) == 0) {
        speed -= 50;
      }

      for (var i = 0; i < rowsToClear.length; i++) {
        board.clearRow(rowsToClear[i]);
      }
      board.renderAllBlocks();
    }

    clearInterval(intervalId);
    newPiece();
    intervalId = setInterval(step, speed);
  }
};

PlayingPiece.prototype.move = function(key) {    
  var value = Number(key);
  var valid = this.fit(value);

  if (valid) {
    this.renderClear();
    if (value == UP) {        
      this.direction = ++this.direction % 4;
    } else if (value == DOWN) { 
      this.update();  
    } else if(value == LEFT) {      
      this.x--;      
    } else if (value == RIGHT) {      
      this.x++;   
    }

    if (value != DOWN) {
      playingPiece = this;
      setTimeout(function(){playingPiece.render()},timeOutToRenderLEDs);
      //this.render();        
    }
  }   
};

function Board(columns,rows) {
  this.board = [];
  this.rows = rows;
  this.columns = columns;

  for (var x = 0; x < columns; x++) {
    this.board[x] = [];
    for (var y = 0; y < rows; y++) {
      this.board[x][y] = 0;
    }
  }  
}

Board.prototype.isBlockEmpty = function(x,y) {
  return this.board[x][y] == 0;
}

Board.prototype.getBlock = function(x,y) {
  return this.board[x][y];
}

Board.prototype.setBlock = function(x,y,color) {
  this.board[x][y] = color;
}

Board.prototype.getHigherRow = function() {
  var higherRow = this.rows-1;

  for (var x = 0; x < this.columns; x++) {    
    for (var y = 0; y < this.rows; y++) {
      if (this.getBlock(x,y) != 0) {
        if (y < higherRow) {
            higherRow = y;
        }        
      }      
    }
  }    
  return higherRow;
}

Board.prototype.checkRows = function() {
  var rows = [];
  for (var y = this.getHigherRow(); y < this.rows; y++) {
    var result = 1;
    for (var x = 0; x < this.columns; x++) {
      result = result && (this.getBlock(x,y) != 0);
    }
    if (result) {
      rows.push(y);
    }
  }
  
  return rows;
};

Board.prototype.clearRow = function(row) {
  for (var x = 0; x < this.columns; x++) {
    this.board[x].splice(row, 1);    
    this.board[x].unshift(0);
  }
}

Board.prototype.renderAllBlocks = function() {
  for (var x = 0; x < this.columns; x++) {    
    for (var y = 0; y < this.rows; y++) {
      if (this.getBlock(x,y) != 0) {
        drawBlock(x, y, this.getBlock(x,y));  
      } else {
        clearBlock(x, y);
      }
    }
  }

  for (var x = 0; x < this.columns; x++) {    
    clearBlock(x, this.getHigherRow()-1);
  }
}


/*
//uncomment for browser support
window.addEventListener("keydown", function(event) {
  currentPlayingPiece.move(event.keyCode);
});
*/

var step = function() {
  currentPlayingPiece.update();
};

function init() {  
  /*
  //uncomment for browser support
  context.fillStyle =  'white';
  context.fillRect(0, 0, width, height);
  */

  board = new Board(cols, rows);  

  var clearBoardID = setInterval(function(){
    var matrixSize = cols * rows;
    for (var i = 0; i < matrixSize; i++) {
      strip.pixel(i).color("#000");
    }
    clearInterval(clearBoardID);
  }, timeOutToRenderLEDs);  

  newPiece();
}

function newGame() {
  init();
  clearInterval(intervalId)
  intervalId = setInterval(step, speed);
}

function newPiece(){
  if (board.getHigherRow() == 0) {
    newGame();
  } else {
    var shapeId = Math.floor( Math.random() * shapes.length);
    currentPlayingPiece = new PlayingPiece (board.columns/2-1, 0, shapes[shapeId]);  
    currentPlayingPiece.render();    
  }
}

function toMatrixPos(x,y){
  return x + (y * board.columns);
}

keypress(process.stdin);
process.stdin.on('keypress', function (ch, key) {  
  if (key && key.name == 'q') {
    process.exit();    
  } else if (key) {
    var k;
    if (key.name === "up")  {
      k = UP;
    } else if (key.name === "down")  {
      k = DOWN;
    } else if (key.name === "left")  {
      k = LEFT;
    } else if (key.name === "right")  {
      k = RIGHT;            
    }
    currentPlayingPiece.move(k);
  }
});

process.stdin.setRawMode(true);
process.stdin.resume();    

j5board.on("ready", function() {
  console.log("Board ready");
  var length = cols * rows;
  strip = new pixel.Strip({
    data: 6,
    length: length,
    board: this
  });


  joystick = new five.Joystick({
    pins: ["A0", "A1"],
    freq: 250
  });

  button = new five.Button("D8"); 

  button.on("press", function() {
    newGame();
  }); 

  joystick.on("axismove", function(err, timestamp) {
    var k = -1;
    if (this.fixed.y < 0.3)  {
      k = UP;
    } else if (this.fixed.y > 0.7)  {
      k = DOWN;
    } else if (this.fixed.x < 0.3)  {
      k = LEFT;
    } else if (this.fixed.x > 0.7)  {
      k = RIGHT;            
    }
    if (k != -1) {
      currentPlayingPiece.move(k);
    }
  });

  newGame();  
});
